import { Prisma } from '@prisma/client';
import { db } from '@/core/db';
import { FREE_PLAN_LIMITS, getCurrentPeriod } from './plan-limits';

export interface UsageData {
  plan: string;
  period: string;
  repositories: { used: number; limit: number };
  healthScans: { used: number; limit: number };
  aiReports: { used: number; limit: number };
  aiChat: { used: number; limit: number };
}

export interface LimitCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
}

class UsageService {
  async getUsage(userId: string): Promise<UsageData> {
    const period = getCurrentPeriod();
    const limits = FREE_PLAN_LIMITS;

    const usage = await this.getOrCreateUsage(userId, period);

    const repoCount = await this.countUserRepositories(userId);

    return {
      plan: 'free',
      period,
      repositories: { used: repoCount, limit: limits.repositories },
      healthScans: { used: usage.healthScanCount, limit: limits.healthScansPerMonth },
      aiReports: { used: usage.aiReportCount, limit: limits.aiReportsPerMonth },
      aiChat: { used: usage.aiChatCount, limit: limits.aiChatRequestsPerMonth },
    };
  }

  async checkHealthScanLimit(userId: string): Promise<LimitCheckResult> {
    const period = getCurrentPeriod();
    const limits = FREE_PLAN_LIMITS;
    const usage = await this.getOrCreateUsage(userId, period);
    return {
      allowed: usage.healthScanCount < limits.healthScansPerMonth,
      used: usage.healthScanCount,
      limit: limits.healthScansPerMonth,
    };
  }

  async incrementHealthScan(userId: string): Promise<void> {
    const period = getCurrentPeriod();
    const localUserId = await this.resolveLocalUserId(userId);
    await db.userUsage.upsert({
      where: { userId_period: { userId: localUserId, period } },
      update: { healthScanCount: { increment: 1 } },
      create: { userId: localUserId, period, healthScanCount: 1 },
    });
  }

  async checkAiReportLimit(userId: string): Promise<LimitCheckResult> {
    const period = getCurrentPeriod();
    const limits = FREE_PLAN_LIMITS;
    const usage = await this.getOrCreateUsage(userId, period);
    return {
      allowed: usage.aiReportCount < limits.aiReportsPerMonth,
      used: usage.aiReportCount,
      limit: limits.aiReportsPerMonth,
    };
  }

  async incrementAiReport(userId: string): Promise<void> {
    const period = getCurrentPeriod();
    const localUserId = await this.resolveLocalUserId(userId);
    await db.userUsage.upsert({
      where: { userId_period: { userId: localUserId, period } },
      update: { aiReportCount: { increment: 1 } },
      create: { userId: localUserId, period, aiReportCount: 1 },
    });
  }

  async checkAiChatLimit(userId: string): Promise<LimitCheckResult> {
    const period = getCurrentPeriod();
    const limits = FREE_PLAN_LIMITS;
    const usage = await this.getOrCreateUsage(userId, period);
    return {
      allowed: usage.aiChatCount < limits.aiChatRequestsPerMonth,
      used: usage.aiChatCount,
      limit: limits.aiChatRequestsPerMonth,
    };
  }

  async incrementAiChat(userId: string): Promise<void> {
    const period = getCurrentPeriod();
    const localUserId = await this.resolveLocalUserId(userId);
    await db.userUsage.upsert({
      where: { userId_period: { userId: localUserId, period } },
      update: { aiChatCount: { increment: 1 } },
      create: { userId: localUserId, period, aiChatCount: 1 },
    });
  }

  async checkRepositoryLimit(userId: string): Promise<LimitCheckResult> {
    const limits = FREE_PLAN_LIMITS;
    const localUserId = await this.resolveLocalUserId(userId);
    const count = await this.countUserRepositories(localUserId);
    return {
      allowed: count < limits.repositories,
      used: count,
      limit: limits.repositories,
    };
  }

  private async countUserRepositories(userId: string): Promise<number> {
    const result = await db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT CONCAT(owner, '/', repo)) as count
      FROM (
        SELECT owner, repo FROM repository_indexes WHERE "userId" = ${userId}
        UNION
        SELECT owner, repo FROM repo_health_snapshots WHERE "userId" = ${userId}
        UNION
        SELECT
          SPLIT_PART(repository, '/', 1) as owner,
          SPLIT_PART(repository, '/', 2) as repo
        FROM ai_history_sessions WHERE "userId" = ${userId} AND repository IS NOT NULL
      ) as repos
    `;
    return Number(result[0]?.count ?? 0);
  }

  private async resolveLocalUserId(supabaseUserId: string): Promise<string> {
    const user = await db.user.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    });
    if (!user) {
      // Auto-create user if they don't exist yet
      const created = await db.user.upsert({
        where: { supabaseUserId },
        update: {},
        create: {
          supabaseUserId,
          email: `${supabaseUserId}@placeholder.local`,
          fullName: 'User',
        },
        select: { id: true },
      });
      return created.id;
    }
    return user.id;
  }

  private async getOrCreateUsage(userId: string, period: string) {
    // Ensure user exists in local database (Supabase user may not have a local record yet)
    const user = await db.user.upsert({
      where: { supabaseUserId: userId },
      update: {},
      create: {
        supabaseUserId: userId,
        email: `${userId}@placeholder.local`,
        fullName: 'User',
      },
      select: { id: true },
    });

    return db.userUsage.upsert({
      where: { userId_period: { userId: user.id, period } },
      update: {},
      create: { userId: user.id, period },
    });
  }

  async getHealthCache(userId: string, owner: string, repo: string, commitSha: string) {
    return db.repoHealthSnapshot.findUnique({
      where: { userId_owner_repo_commitSha: { userId, owner, repo, commitSha } },
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
    return db.repoHealthSnapshot.upsert({
      where: { userId_owner_repo_commitSha: { userId, owner, repo, commitSha } },
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
        userId,
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
}

export const usageService = new UsageService();
