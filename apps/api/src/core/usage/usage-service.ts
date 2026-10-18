import { Prisma } from '@prisma/client';
import { db, resolveLocalUserId } from '@/core/db';
import {
  getPlanLimits,
  getLimitForFeature,
  getCurrentMonthPeriod,
  type PlanLimits,
  type UsageFeature,
} from './plan-limits';
import { AI_CREDIT_COSTS, type AICreditCostKey } from './credit-costs';
import type { UsageLimitErrorDetails } from './errors';

export type UsageCounterField =
  'aiCreditsUsed' | 'healthScansUsed' | 'aiReportsUsed' | 'chatMessagesUsed';

export interface UsageSummary {
  plan: string;
  periodStart: string;
  periodEnd: string;
  /** Alias for periodEnd — when counters reset. */
  resetAt: string;
  usage: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
  limits: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
  remaining: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
  creditCosts: Record<AICreditCostKey, number>;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  details?: UsageLimitErrorDetails;
}

export interface ConsumeResult extends QuotaCheckResult {
  /** True when quota was successfully consumed. */
  consumed: boolean;
}

export interface UsageRow {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  aiCreditsUsed: number;
  healthScansUsed: number;
  aiReportsUsed: number;
  chatMessagesUsed: number;
}

export interface AIUsageEventInput {
  userId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  creditsConsumed: number;
  estimatedCostUsd?: number;
}

export class UsageLimitExceededError extends Error {
  readonly details: UsageLimitErrorDetails;

  constructor(details: UsageLimitErrorDetails) {
    super(`USAGE_LIMIT_REACHED:${details.feature}`);
    this.name = 'UsageLimitExceededError';
    this.details = details;
  }
}

const FEATURE_COUNTER: Record<Exclude<UsageFeature, 'REPOSITORIES'>, UsageCounterField> = {
  HEALTH_SCAN: 'healthScansUsed',
  AI_REPORT: 'aiReportsUsed',
  CHAT_MESSAGE: 'chatMessagesUsed',
  AI_CREDITS: 'aiCreditsUsed',
};

class UsageService {
  /** Resolve local user id (creates placeholder user if needed). */
  async resolveUserId(supabaseUserId: string): Promise<string> {
    return resolveLocalUserId(supabaseUserId);
  }

  /** Determine the user's organization plan (defaults to FREE). */
  async getPlanForUser(supabaseUserId: string): Promise<string> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const user = await db.user.findUnique({
      where: { id: localUserId },
      select: { organization: { select: { plan: true } } },
    });
    return user?.organization?.plan ?? 'FREE';
  }

  async getPlanLimitsForUser(supabaseUserId: string): Promise<PlanLimits> {
    const plan = await this.getPlanForUser(supabaseUserId);
    return getPlanLimits(plan);
  }

  /**
   * Lazily create the current-month usage row if missing.
   */
  async getOrCreateUsage(localUserId: string): Promise<UsageRow> {
    const { periodStart, periodEnd } = getCurrentMonthPeriod();
    return db.userUsage.upsert({
      where: { userId_periodStart: { userId: localUserId, periodStart } },
      update: {},
      create: { userId: localUserId, periodStart, periodEnd },
    });
  }

  /**
   * Count distinct owner/repo pairs the user has actually activated/used
   * via DevPilot features (repository indexes and AI history sessions).
   *
   * Deliberately excludes `repo_health_snapshots`: those rows are created as a
   * side effect of merely viewing overview/health pages and must not consume
   * the repository quota. GitHub repo listings also never write here.
   *
   * Identity is stable `owner/repo` (distinct), so re-use never double-counts.
   */
  async countUserRepositories(localUserId: string): Promise<number> {
    const result = await db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT CONCAT(owner, '/', repo)) as count
      FROM (
        SELECT owner, repo FROM repository_indexes WHERE "userId" = ${localUserId}::uuid
        UNION
        SELECT
          SPLIT_PART(repository, '/', 1) as owner,
          SPLIT_PART(repository, '/', 2) as repo
        FROM ai_history_sessions
        WHERE "userId" = ${localUserId}::uuid
          AND repository IS NOT NULL
          AND POSITION('/' IN repository) > 0
      ) as repos
    `;
    return Number(result[0]?.count ?? 0);
  }

  /** True when owner/repo is already an active DevPilot repository for this user. */
  async isRepositoryActive(localUserId: string, owner: string, repo: string): Promise<boolean> {
    const result = await db.$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS (
        SELECT 1 FROM repository_indexes
        WHERE "userId" = ${localUserId}::uuid AND owner = ${owner} AND repo = ${repo}
        UNION
        SELECT 1 FROM ai_history_sessions
        WHERE "userId" = ${localUserId}::uuid
          AND repository = ${`${owner}/${repo}`}
      ) as exists
    `;
    return Boolean(result[0]?.exists);
  }

  /**
   * Ensure the user may use `owner/repo` under the REPOSITORIES plan limit.
   *
   * - Already-active repo → allowed (cached/second use never re-charges).
   * - New repo when under limit → allowed; writes a lightweight activation
   *   marker into `repository_indexes` so the repo is counted exactly once.
   * - New repo when at/over limit → rejected with USAGE_LIMIT_REACHED details.
   *
   * Uses a transaction-scoped advisory lock keyed on the user id so concurrent
   * activations of different repos cannot both pass the limit check.
   */
  async ensureRepositoryAccess(
    supabaseUserId: string,
    owner: string,
    repo: string,
  ): Promise<QuotaCheckResult> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const plan = await this.getPlanForUser(supabaseUserId);
    const limits = getPlanLimits(plan);
    const { periodEnd } = getCurrentMonthPeriod();
    const limit = limits.repositories;

    const active = await this.isRepositoryActive(localUserId, owner, repo);
    if (active) {
      const used = await this.countUserRepositories(localUserId);
      return {
        allowed: true,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        resetAt: periodEnd,
      };
    }

    const outcome = await db.$transaction(async (tx) => {
      // Serialize repository activations for this user.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${localUserId}::text))`;

      const stillActive = await tx.$queryRaw<[{ exists: boolean }]>`
        SELECT EXISTS (
          SELECT 1 FROM repository_indexes
          WHERE "userId" = ${localUserId}::uuid AND owner = ${owner} AND repo = ${repo}
          UNION
          SELECT 1 FROM ai_history_sessions
          WHERE "userId" = ${localUserId}::uuid
            AND repository = ${`${owner}/${repo}`}
        ) as exists
      `;
      if (stillActive[0]?.exists) {
        const usedNow = await this.countUserRepositories(localUserId);
        return { ok: true as const, used: usedNow };
      }

      const countResult = await tx.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT CONCAT(owner, '/', repo)) as count
        FROM (
          SELECT owner, repo FROM repository_indexes WHERE "userId" = ${localUserId}::uuid
          UNION
          SELECT
            SPLIT_PART(repository, '/', 1) as owner,
            SPLIT_PART(repository, '/', 2) as repo
          FROM ai_history_sessions
          WHERE "userId" = ${localUserId}::uuid
            AND repository IS NOT NULL
            AND POSITION('/' IN repository) > 0
        ) as repos
      `;
      const used = Number(countResult[0]?.count ?? 0);

      if (used >= limit) {
        return { ok: false as const, used };
      }

      // Activation marker: counted by countUserRepositories exactly once (DISTINCT).
      // Real indexing later upserts over this row for the same (user, owner, repo, branch).
      await tx.repositoryIndex.upsert({
        where: {
          userId_owner_repo_branch: { userId: localUserId, owner, repo, branch: 'main' },
        },
        update: {},
        create: {
          userId: localUserId,
          owner,
          repo,
          branch: 'main',
          commitSha: '',
          status: 'NOT_INDEXED',
          tree: [],
          fileMetadata: [],
          languageBreakdown: {},
          stats: {},
        },
      });

      return { ok: true as const, used: used + 1 };
    });

    if (!outcome.ok) {
      return {
        allowed: false,
        used: outcome.used,
        limit,
        remaining: Math.max(0, limit - outcome.used),
        resetAt: periodEnd,
        details: { feature: 'REPOSITORIES', used: outcome.used, limit, resetAt: periodEnd },
      };
    }

    return {
      allowed: true,
      used: outcome.used,
      limit,
      remaining: Math.max(0, limit - outcome.used),
      resetAt: periodEnd,
    };
  }

  /**
   * Non-consuming quota check for a single feature.
   */
  async checkQuota(
    supabaseUserId: string,
    feature: UsageFeature,
    amount = 1,
  ): Promise<QuotaCheckResult> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const plan = await this.getPlanForUser(supabaseUserId);
    const limits = getPlanLimits(plan);
    const { periodEnd } = getCurrentMonthPeriod();
    const limit = getLimitForFeature(limits, feature);

    let used: number;
    if (feature === 'REPOSITORIES') {
      used = await this.countUserRepositories(localUserId);
    } else {
      const usage = await this.getOrCreateUsage(localUserId);
      used = usage[FEATURE_COUNTER[feature]];
    }

    const allowed = used + amount <= limit;
    return {
      allowed,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: periodEnd,
      details: allowed ? undefined : { feature, used, limit, resetAt: periodEnd },
    };
  }

  /**
   * Atomically consume quota for a single feature.
   * Uses a conditional UPDATE inside a transaction so concurrent requests
   * cannot both pass the limit check.
   *
   * REPOSITORIES is not a counter — use checkQuota/countUserRepositories for it.
   */
  async consumeQuota(
    supabaseUserId: string,
    feature: Exclude<UsageFeature, 'REPOSITORIES'>,
    amount = 1,
  ): Promise<ConsumeResult> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const plan = await this.getPlanForUser(supabaseUserId);
    const limits = getPlanLimits(plan);
    const { periodStart, periodEnd } = getCurrentMonthPeriod();
    const field = FEATURE_COUNTER[feature];
    const limit = getLimitForFeature(limits, feature);

    const result = await db.$transaction(async (tx) => {
      await tx.userUsage.upsert({
        where: { userId_periodStart: { userId: localUserId, periodStart } },
        update: {},
        create: { userId: localUserId, periodStart, periodEnd },
      });

      // Atomic conditional increment: only succeeds while under limit.
      const updated = await tx.userUsage.updateMany({
        where: {
          userId: localUserId,
          periodStart,
          [field]: { lte: limit - amount },
        },
        data: { [field]: { increment: amount } },
      });

      const row = await tx.userUsage.findUniqueOrThrow({
        where: { userId_periodStart: { userId: localUserId, periodStart } },
      });

      return { count: updated.count, row };
    });
    const used = result.row[field];
    const allowed = result.count > 0;
    return {
      allowed,
      consumed: allowed,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: periodEnd,
      details: allowed
        ? undefined
        : { feature, used: used - (allowed ? amount : 0), limit, resetAt: periodEnd },
    };
  }

  /**
   * Atomically consume a feature quota AND its associated AI credit cost
   * in a single transaction (all-or-nothing).
   */
  async consumeWithCredits(
    supabaseUserId: string,
    feature: Exclude<UsageFeature, 'REPOSITORIES' | 'AI_CREDITS'>,
    creditKey: AICreditCostKey,
  ): Promise<ConsumeResult> {
    const creditCost = AI_CREDIT_COSTS[creditKey];
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const plan = await this.getPlanForUser(supabaseUserId);
    const limits = getPlanLimits(plan);
    const { periodStart, periodEnd } = getCurrentMonthPeriod();
    const field = FEATURE_COUNTER[feature];
    const featureLimit = getLimitForFeature(limits, feature);
    const creditLimit = limits.aiCredits;

    const result = await db.$transaction(async (tx) => {
      await tx.userUsage.upsert({
        where: { userId_periodStart: { userId: localUserId, periodStart } },
        update: {},
        create: { userId: localUserId, periodStart, periodEnd },
      });

      const current = await tx.userUsage.findUniqueOrThrow({
        where: { userId_periodStart: { userId: localUserId, periodStart } },
      });

      const featureOk = current[field] + 1 <= featureLimit;
      const creditsOk = current.aiCreditsUsed + creditCost <= creditLimit;

      if (!featureOk || !creditsOk) {
        const failingFeature: UsageFeature = !featureOk ? feature : 'AI_CREDITS';
        const failingUsed = !featureOk ? current[field] : current.aiCreditsUsed;
        const failingLimit = !featureOk ? featureLimit : creditLimit;
        return {
          ok: false as const,
          used: current[field],
          details: {
            feature: failingFeature,
            used: failingUsed,
            limit: failingLimit,
            resetAt: periodEnd,
          } satisfies UsageLimitErrorDetails,
        };
      }

      const updated = await tx.userUsage.updateMany({
        where: {
          userId: localUserId,
          periodStart,
          [field]: { lte: featureLimit - 1 },
          aiCreditsUsed: { lte: creditLimit - creditCost },
        },
        data: {
          [field]: { increment: 1 },
          aiCreditsUsed: { increment: creditCost },
        },
      });

      if (updated.count === 0) {
        const current2 = await tx.userUsage.findUniqueOrThrow({
          where: { userId_periodStart: { userId: localUserId, periodStart } },
        });
        const featureOk2 = current2[field] < featureLimit;
        const failingFeature: UsageFeature = !featureOk2 ? feature : 'AI_CREDITS';
        const failingUsed = !featureOk2 ? current2[field] : current2.aiCreditsUsed;
        const failingLimit = !featureOk2 ? featureLimit : creditLimit;
        return {
          ok: false as const,
          used: current2[field],
          details: {
            feature: failingFeature,
            used: failingUsed,
            limit: failingLimit,
            resetAt: periodEnd,
          } satisfies UsageLimitErrorDetails,
        };
      }

      const after = await tx.userUsage.findUniqueOrThrow({
        where: { userId_periodStart: { userId: localUserId, periodStart } },
      });
      return { ok: true as const, used: after[field] };
    });

    if (!result.ok) {
      return {
        allowed: false,
        consumed: false,
        used: result.used,
        limit: result.details.feature === feature ? featureLimit : creditLimit,
        remaining: Math.max(
          0,
          (result.details.feature === feature ? featureLimit : creditLimit) - result.details.used,
        ),
        resetAt: periodEnd,
        details: result.details,
      };
    }

    return {
      allowed: true,
      consumed: true,
      used: result.used,
      limit: featureLimit,
      remaining: Math.max(0, featureLimit - result.used),
      resetAt: periodEnd,
    };
  }

  /**
   * Refund a previously consumed feature amount (e.g. when generation fails after consume).
   */
  async refundQuota(
    supabaseUserId: string,
    feature: Exclude<UsageFeature, 'REPOSITORIES'>,
    amount = 1,
  ): Promise<void> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const { periodStart } = getCurrentMonthPeriod();
    const field = FEATURE_COUNTER[feature];
    await db.userUsage
      .updateMany({
        where: { userId: localUserId, periodStart, [field]: { gte: amount } },
        data: { [field]: { decrement: amount } },
      })
      .catch(() => {
        // Best-effort refund; ignore if row missing.
      });
  }

  /**
   * Refund feature + credits (inverse of consumeWithCredits).
   */
  async refundWithCredits(
    supabaseUserId: string,
    feature: Exclude<UsageFeature, 'REPOSITORIES' | 'AI_CREDITS'>,
    creditKey: AICreditCostKey,
  ): Promise<void> {
    const creditCost = AI_CREDIT_COSTS[creditKey];
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const { periodStart } = getCurrentMonthPeriod();
    const field = FEATURE_COUNTER[feature];
    await db.userUsage
      .updateMany({
        where: {
          userId: localUserId,
          periodStart,
          [field]: { gte: 1 },
          aiCreditsUsed: { gte: creditCost },
        },
        data: {
          [field]: { decrement: 1 },
          aiCreditsUsed: { decrement: creditCost },
        },
      })
      .catch(() => {
        // Best-effort refund.
      });
  }

  /**
   * Full usage summary for GET /usage.
   */
  async getUsageSummary(supabaseUserId: string): Promise<UsageSummary> {
    const localUserId = await resolveLocalUserId(supabaseUserId);
    const plan = await this.getPlanForUser(supabaseUserId);
    const limits = getPlanLimits(plan);
    const { periodStart, periodEnd } = getCurrentMonthPeriod();

    const usage = await this.getOrCreateUsage(localUserId);
    const repositories = await this.countUserRepositories(localUserId);

    const remaining = {
      aiCredits: Math.max(0, limits.aiCredits - usage.aiCreditsUsed),
      healthScans: Math.max(0, limits.healthScans - usage.healthScansUsed),
      aiReports: Math.max(0, limits.aiReports - usage.aiReportsUsed),
      chatMessages: Math.max(0, limits.chatMessages - usage.chatMessagesUsed),
      repositories: Math.max(0, limits.repositories - repositories),
    };
    // Note: repositories (and all counters) may legitimately exceed limits when
    // historical data predates enforcement — remaining clamps at 0, usage shows truth.

    return {
      plan,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      resetAt: periodEnd.toISOString(),
      usage: {
        aiCredits: usage.aiCreditsUsed,
        healthScans: usage.healthScansUsed,
        aiReports: usage.aiReportsUsed,
        chatMessages: usage.chatMessagesUsed,
        repositories,
      },
      limits: {
        aiCredits: limits.aiCredits,
        healthScans: limits.healthScans,
        aiReports: limits.aiReports,
        chatMessages: limits.chatMessages,
        repositories: limits.repositories,
      },
      remaining,
      creditCosts: { ...AI_CREDIT_COSTS },
    };
  }

  // ─── Health cache (commit SHA) ──────────────────────────────────────────

  async getHealthCache(userId: string, owner: string, repo: string, commitSha: string) {
    const localUserId = await resolveLocalUserId(userId);
    return db.repoHealthSnapshot.findUnique({
      where: { userId_owner_repo_commitSha: { userId: localUserId, owner, repo, commitSha } },
    });
  }

  async saveHealthCache(
    userId: string,
    owner: string,
    repo: string,
    commitSha: string,
    health: {
      score: number;
      passedCount: number;
      failedCount: number;
      criticalCount: number;
      structuralScore: number;
      qualityScore: number;
      details: unknown;
      scoreBreakdown: unknown;
      summary: unknown;
    },
  ) {
    const localUserId = await resolveLocalUserId(userId);
    return db.repoHealthSnapshot.upsert({
      where: { userId_owner_repo_commitSha: { userId: localUserId, owner, repo, commitSha } },
      update: {
        score: health.score,
        passedCount: health.passedCount,
        failedCount: health.failedCount,
        criticalCount: health.criticalCount,
        structuralScore: health.structuralScore,
        qualityScore: health.qualityScore,
        details: JSON.parse(JSON.stringify(health.details)) as Prisma.InputJsonValue,
        scoreBreakdown: JSON.parse(JSON.stringify(health.scoreBreakdown)) as Prisma.InputJsonValue,
        summary: JSON.parse(JSON.stringify(health.summary)) as Prisma.InputJsonValue,
      },
      create: {
        userId: localUserId,
        owner,
        repo,
        commitSha,
        score: health.score,
        passedCount: health.passedCount,
        failedCount: health.failedCount,
        criticalCount: health.criticalCount,
        structuralScore: health.structuralScore,
        qualityScore: health.qualityScore,
        details: JSON.parse(JSON.stringify(health.details)) as Prisma.InputJsonValue,
        scoreBreakdown: JSON.parse(JSON.stringify(health.scoreBreakdown)) as Prisma.InputJsonValue,
        summary: JSON.parse(JSON.stringify(health.summary)) as Prisma.InputJsonValue,
      },
    });
  }

  // ─── AI usage audit ─────────────────────────────────────────────────────

  /**
   * Record an AIUsageEvent. Only call when actual token usage is available.
   * Never store access/refresh tokens.
   */
  async recordAIUsageEvent(event: AIUsageEventInput): Promise<void> {
    try {
      const localUserId = await resolveLocalUserId(event.userId);
      await db.aIUsageEvent.create({
        data: {
          userId: localUserId,
          feature: event.feature,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          creditsConsumed: event.creditsConsumed,
          estimatedCostUsd: event.estimatedCostUsd ?? 0,
        },
      });
    } catch {
      // Audit must never break the main request path.
    }
  }

  // ─── Backward-compatible helpers (legacy route call sites) ──────────────

  async checkHealthScanLimit(
    userId: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const r = await this.checkQuota(userId, 'HEALTH_SCAN');
    return { allowed: r.allowed, used: r.used, limit: r.limit };
  }

  async incrementHealthScan(userId: string): Promise<void> {
    await this.consumeQuota(userId, 'HEALTH_SCAN');
  }

  async checkAiReportLimit(
    userId: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const r = await this.checkQuota(userId, 'AI_REPORT');
    return { allowed: r.allowed, used: r.used, limit: r.limit };
  }

  async incrementAiReport(userId: string): Promise<void> {
    await this.consumeQuota(userId, 'AI_REPORT');
  }

  async checkAiChatLimit(
    userId: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const r = await this.checkQuota(userId, 'CHAT_MESSAGE');
    return { allowed: r.allowed, used: r.used, limit: r.limit };
  }

  async incrementAiChat(userId: string): Promise<void> {
    await this.consumeQuota(userId, 'CHAT_MESSAGE');
  }

  async checkRepositoryLimit(
    userId: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    const localUserId = await resolveLocalUserId(userId);
    const limits = await this.getPlanLimitsForUser(userId);
    const used = await this.countUserRepositories(localUserId);
    return { allowed: used < limits.repositories, used, limit: limits.repositories };
  }

  /** Legacy getUsage shape (kept for any external callers). */
  async getUsage(userId: string) {
    const summary = await this.getUsageSummary(userId);
    return {
      plan: summary.plan.toLowerCase(),
      period: summary.periodStart.slice(0, 7),
      repositories: {
        used: summary.usage.repositories,
        limit: summary.limits.repositories,
      },
      healthScans: {
        used: summary.usage.healthScans,
        limit: summary.limits.healthScans,
      },
      aiReports: {
        used: summary.usage.aiReports,
        limit: summary.limits.aiReports,
      },
      aiChat: {
        used: summary.usage.chatMessages,
        limit: summary.limits.chatMessages,
      },
      aiCredits: {
        used: summary.usage.aiCredits,
        limit: summary.limits.aiCredits,
      },
    };
  }
}

export const usageService = new UsageService();
