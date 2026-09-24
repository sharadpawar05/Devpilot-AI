import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  FREE_PLAN_LIMITS,
  PLAN_LIMITS,
  getCurrentMonthPeriod,
  getCurrentPeriod,
  getPlanLimits,
  getLimitForFeature,
} from '../plan-limits';
import { AI_CREDIT_COSTS } from '../credit-costs';

// Mock Prisma and auth-dependent resolveLocalUserId
vi.mock('@/core/db', () => ({
  resolveLocalUserId: vi.fn(async (id: string) => id),
  db: {
    user: {
      findUnique: vi.fn(),
    },
    userUsage: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    aIUsageEvent: {
      create: vi.fn(),
    },
    repoHealthSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

import { usageService } from '../usage-service';
import { db, resolveLocalUserId } from '@/core/db';

const mockDb = db as unknown as {
  user: { findUnique: Mock };
  userUsage: { upsert: Mock; findUnique: Mock; findUniqueOrThrow: Mock; updateMany: Mock };
  aIUsageEvent: { create: Mock };
  repoHealthSnapshot: { findUnique: Mock; upsert: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
};
const mockResolve = resolveLocalUserId as Mock;

describe('Plan Limits', () => {
  it('should have correct free plan limits', () => {
    expect(FREE_PLAN_LIMITS.repositories).toBe(1);
    expect(FREE_PLAN_LIMITS.aiCredits).toBe(50);
    expect(FREE_PLAN_LIMITS.healthScans).toBe(2);
    expect(FREE_PLAN_LIMITS.aiReports).toBe(2);
    expect(FREE_PLAN_LIMITS.chatMessages).toBe(20);
  });

  it('should have correct starter/pro/enterprise limits', () => {
    expect(PLAN_LIMITS.STARTER).toEqual({
      repositories: 3,
      aiCredits: 500,
      healthScans: 10,
      aiReports: 20,
      chatMessages: 100,
    });
    expect(PLAN_LIMITS.PRO).toEqual({
      repositories: 10,
      aiCredits: 1500,
      healthScans: 30,
      aiReports: 60,
      chatMessages: 300,
    });
    expect(PLAN_LIMITS.ENTERPRISE).toEqual({
      repositories: 25,
      aiCredits: 5000,
      healthScans: 100,
      aiReports: 200,
      chatMessages: 1000,
    });
  });

  it('getPlanLimits should default to FREE for unknown plans', () => {
    expect(getPlanLimits('UNKNOWN')).toEqual(PLAN_LIMITS.FREE);
    expect(getPlanLimits(null)).toEqual(PLAN_LIMITS.FREE);
    expect(getPlanLimits('PRO')).toEqual(PLAN_LIMITS.PRO);
  });

  it('getLimitForFeature should map features correctly', () => {
    expect(getLimitForFeature(FREE_PLAN_LIMITS, 'REPOSITORIES')).toBe(1);
    expect(getLimitForFeature(FREE_PLAN_LIMITS, 'HEALTH_SCAN')).toBe(2);
    expect(getLimitForFeature(FREE_PLAN_LIMITS, 'AI_REPORT')).toBe(2);
    expect(getLimitForFeature(FREE_PLAN_LIMITS, 'CHAT_MESSAGE')).toBe(20);
    expect(getLimitForFeature(FREE_PLAN_LIMITS, 'AI_CREDITS')).toBe(50);
  });

  it('getCurrentPeriod should return YYYY-MM format', () => {
    expect(getCurrentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('getCurrentMonthPeriod should return first day of month UTC to next month', () => {
    const { periodStart, periodEnd } = getCurrentMonthPeriod();
    expect(periodStart.getUTCDate()).toBe(1);
    expect(periodEnd.getTime()).toBeGreaterThan(periodStart.getTime());
    expect(periodEnd.getUTCDate()).toBe(1);
  });
});

describe('AI Credit Costs', () => {
  it('should have required credit costs', () => {
    expect(AI_CREDIT_COSTS.SIMPLE_CHAT).toBe(1);
    expect(AI_CREDIT_COSTS.REPOSITORY_CHAT).toBe(5);
    expect(AI_CREDIT_COSTS.AI_REPORT).toBe(3);
    expect(AI_CREDIT_COSTS.PR_REVIEW).toBe(5);
    expect(AI_CREDIT_COSTS.REPOSITORY_OVERVIEW).toBe(10);
    expect(AI_CREDIT_COSTS.HEALTH_SCAN).toBe(15);
    expect(AI_CREDIT_COSTS.ARCHITECTURE_ANALYSIS).toBe(20);
  });
});

describe('UsageService', () => {
  const userId = 'test-user-id';
  const localRow = {
    id: '1',
    userId,
    periodStart: getCurrentMonthPeriod().periodStart,
    periodEnd: getCurrentMonthPeriod().periodEnd,
    aiCreditsUsed: 0,
    healthScansUsed: 0,
    aiReportsUsed: 0,
    chatMessagesUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockResolvedValue(userId);
    mockDb.user.findUnique.mockResolvedValue({
      organization: { plan: 'FREE' },
    });
    mockDb.userUsage.upsert.mockResolvedValue(localRow);
    mockDb.userUsage.findUnique.mockResolvedValue(localRow);
    mockDb.userUsage.findUniqueOrThrow.mockResolvedValue(localRow);
    mockDb.userUsage.updateMany.mockResolvedValue({ count: 1 });
    mockDb.$queryRaw.mockResolvedValue([{ count: 0n }]);
    mockDb.aIUsageEvent.create.mockResolvedValue({});
    mockDb.repoHealthSnapshot.findUnique.mockResolvedValue(null);

    // Default transaction: invoke callback with a tx mock
    const tx = {
      userUsage: {
        upsert: vi.fn().mockResolvedValue(localRow),
        findUniqueOrThrow: vi.fn().mockResolvedValue(localRow),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockDb.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (t: typeof tx) => Promise<unknown>)(tx),
    );
  });

  describe('checkQuota', () => {
    it('should allow health scan when under limit', async () => {
      const result = await usageService.checkQuota(userId, 'HEALTH_SCAN');
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(2);
      expect(result.remaining).toBe(2);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should reject health scan when at limit', async () => {
      mockDb.userUsage.findUnique.mockResolvedValue({
        ...localRow,
        healthScansUsed: 2,
      });
      mockDb.userUsage.upsert.mockResolvedValue({
        ...localRow,
        healthScansUsed: 2,
      });

      const result = await usageService.checkQuota(userId, 'HEALTH_SCAN');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(2);
      expect(result.limit).toBe(2);
      expect(result.details?.feature).toBe('HEALTH_SCAN');
      expect(result.details?.resetAt).toBeInstanceOf(Date);
    });

    it('should reject AI report when at limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        ...localRow,
        aiReportsUsed: 2,
      });

      const result = await usageService.checkQuota(userId, 'AI_REPORT');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(2);
      expect(result.limit).toBe(2);
    });

    it('should reject chat when at limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        ...localRow,
        chatMessagesUsed: 20,
      });

      const result = await usageService.checkQuota(userId, 'CHAT_MESSAGE');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(20);
      expect(result.limit).toBe(20);
    });

    it('should count distinct repositories from raw query', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 2n }]);
      const result = await usageService.checkQuota(userId, 'REPOSITORIES');
      expect(result.used).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.allowed).toBe(false); // FREE allows only 1
    });

    it('should isolate periods using current UTC month', async () => {
      await usageService.checkQuota(userId, 'HEALTH_SCAN');
      const callArgs = mockDb.userUsage.upsert.mock.calls[0][0] as {
        where: { userId_periodStart: { periodStart: Date } };
      };
      const expected = getCurrentMonthPeriod().periodStart;
      expect(callArgs.where.userId_periodStart.periodStart.getTime()).toBe(expected.getTime());
    });
  });

  describe('consumeQuota (atomic)', () => {
    it('should consume when under limit', async () => {
      const result = await usageService.consumeQuota(userId, 'AI_REPORT');
      expect(result.allowed).toBe(true);
      expect(result.consumed).toBe(true);
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('should reject when at limit without consuming', async () => {
      const tx = {
        userUsage: {
          upsert: vi.fn().mockResolvedValue(localRow),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...localRow,
            aiReportsUsed: 2,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockDb.$transaction.mockImplementation(async (fn: unknown) =>
        (fn as (t: typeof tx) => Promise<unknown>)(tx),
      );

      const result = await usageService.consumeQuota(userId, 'AI_REPORT');
      expect(result.allowed).toBe(false);
      expect(result.consumed).toBe(false);
      expect(result.details?.feature).toBe('AI_REPORT');
      expect(result.details?.used).toBe(2);
      expect(result.details?.limit).toBe(2);
    });

    it('should use conditional updateMany for race safety', async () => {
      const tx = {
        userUsage: {
          upsert: vi.fn().mockResolvedValue(localRow),
          findUniqueOrThrow: vi.fn().mockResolvedValue(localRow),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      mockDb.$transaction.mockImplementation(async (fn: unknown) =>
        (fn as (t: typeof tx) => Promise<unknown>)(tx),
      );
      await usageService.consumeQuota(userId, 'HEALTH_SCAN');
      expect(tx.userUsage.updateMany).toHaveBeenCalled();
      const args = tx.userUsage.updateMany.mock.calls[0][0] as {
        where: { healthScansUsed: { lte: number } };
        data: { healthScansUsed: { increment: number } };
      };
      expect(args.where.healthScansUsed.lte).toBe(1); // limit 2 - amount 1
      expect(args.data.healthScansUsed.increment).toBe(1);
    });
  });

  describe('consumeWithCredits', () => {
    it('should consume feature and credits together', async () => {
      const result = await usageService.consumeWithCredits(userId, 'AI_REPORT', 'AI_REPORT');
      expect(result.allowed).toBe(true);
      expect(result.consumed).toBe(true);
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('should fail when feature at limit', async () => {
      const tx = {
        userUsage: {
          upsert: vi.fn().mockResolvedValue(localRow),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...localRow,
            aiReportsUsed: 2,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockDb.$transaction.mockImplementation(async (fn: unknown) =>
        (fn as (t: typeof tx) => Promise<unknown>)(tx),
      );

      const result = await usageService.consumeWithCredits(userId, 'AI_REPORT', 'AI_REPORT');
      expect(result.allowed).toBe(false);
      expect(result.details?.feature).toBe('AI_REPORT');
    });

    it('should fail when credits exhausted even if feature under limit', async () => {
      const tx = {
        userUsage: {
          upsert: vi.fn().mockResolvedValue(localRow),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...localRow,
            aiCreditsUsed: 50,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockDb.$transaction.mockImplementation(async (fn: unknown) =>
        (fn as (t: typeof tx) => Promise<unknown>)(tx),
      );

      const result = await usageService.consumeWithCredits(userId, 'AI_REPORT', 'AI_REPORT');
      expect(result.allowed).toBe(false);
      expect(result.details?.feature).toBe('AI_CREDITS');
      expect(result.details?.used).toBe(50);
      expect(result.details?.limit).toBe(50);
    });
  });

  describe('getUsageSummary', () => {
    it('should return plan, period, usage, limits, remaining', async () => {
      const summary = await usageService.getUsageSummary(userId);
      expect(summary.plan).toBe('FREE');
      expect(summary.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(summary.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(summary.limits).toEqual({
        aiCredits: 50,
        healthScans: 2,
        aiReports: 2,
        chatMessages: 20,
        repositories: 1,
      });
      expect(summary.usage).toHaveProperty('aiCredits');
      expect(summary.usage).toHaveProperty('repositories');
      expect(summary.remaining.aiCredits).toBe(50);
    });

    it('should respect PRO plan limits', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        organization: { plan: 'PRO' },
      });
      const summary = await usageService.getUsageSummary(userId);
      expect(summary.plan).toBe('PRO');
      expect(summary.limits.repositories).toBe(10);
      expect(summary.limits.aiCredits).toBe(1500);
      expect(summary.limits.healthScans).toBe(30);
      expect(summary.limits.aiReports).toBe(60);
      expect(summary.limits.chatMessages).toBe(300);
    });
  });

  describe('getHealthCache', () => {
    it('should return cached health result by commit SHA', async () => {
      const cachedData = {
        id: '1',
        userId,
        owner: 'test-owner',
        repo: 'test-repo',
        commitSha: 'abc123',
        score: 85,
        passedCount: 10,
        failedCount: 2,
        criticalCount: 0,
        structuralScore: 90,
        qualityScore: 80,
        details: {},
        scoreBreakdown: [],
        summary: {},
        createdAt: new Date(),
      };
      mockDb.repoHealthSnapshot.findUnique.mockResolvedValue(cachedData);

      const result = await usageService.getHealthCache(userId, 'test-owner', 'test-repo', 'abc123');
      expect(result).toEqual(cachedData);
      const args = mockDb.repoHealthSnapshot.findUnique.mock.calls[0][0] as {
        where: { userId_owner_repo_commitSha: { commitSha: string } };
      };
      expect(args.where.userId_owner_repo_commitSha.commitSha).toBe('abc123');
    });

    it('should return null for cache miss', async () => {
      mockDb.repoHealthSnapshot.findUnique.mockResolvedValue(null);
      const result = await usageService.getHealthCache(userId, 'test-owner', 'test-repo', 'abc123');
      expect(result).toBeNull();
    });
  });

  describe('recordAIUsageEvent', () => {
    it('should create an AIUsageEvent', async () => {
      await usageService.recordAIUsageEvent({
        userId,
        feature: 'AI_REPORT',
        model: 'gemini-3.6-flash',
        inputTokens: 100,
        outputTokens: 50,
        creditsConsumed: 3,
        estimatedCostUsd: 0.01,
      });
      expect(mockDb.aIUsageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          feature: 'AI_REPORT',
          model: 'gemini-3.6-flash',
          inputTokens: 100,
          outputTokens: 50,
          creditsConsumed: 3,
          estimatedCostUsd: 0.01,
        }),
      });
    });

    it('should not throw on audit failure', async () => {
      mockDb.aIUsageEvent.create.mockRejectedValue(new Error('db down'));
      await expect(
        usageService.recordAIUsageEvent({
          userId,
          feature: 'AI_REPORT',
          model: 'm',
          inputTokens: 0,
          outputTokens: 0,
          creditsConsumed: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
