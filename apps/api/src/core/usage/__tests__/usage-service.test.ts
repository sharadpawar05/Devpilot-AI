import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FREE_PLAN_LIMITS, getCurrentPeriod } from '../plan-limits';

// Mock Prisma
vi.mock('@/core/db', () => ({
  db: {
    userUsage: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    repoHealthSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { usageService } from '../usage-service';
import { db } from '@/core/db';

const mockDb = vi.mocked(db);

describe('Plan Limits', () => {
  it('should have correct free plan limits', () => {
    expect(FREE_PLAN_LIMITS.repositories).toBe(3);
    expect(FREE_PLAN_LIMITS.healthScansPerMonth).toBe(5);
    expect(FREE_PLAN_LIMITS.aiReportsPerMonth).toBe(5);
    expect(FREE_PLAN_LIMITS.aiChatRequestsPerMonth).toBe(20);
  });

  it('getCurrentPeriod should return YYYY-MM format', () => {
    const period = getCurrentPeriod();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('UsageService', () => {
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkHealthScanLimit', () => {
    it('should allow scan when under limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 3,
        aiReportCount: 0,
        aiChatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkHealthScanLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('should reject scan when at limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 5,
        aiReportCount: 0,
        aiChatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkHealthScanLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(5);
      expect(result.limit).toBe(5);
    });
  });

  describe('checkAiReportLimit', () => {
    it('should allow report when under limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 0,
        aiReportCount: 2,
        aiChatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkAiReportLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(2);
      expect(result.limit).toBe(5);
    });

    it('should reject report when at limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 0,
        aiReportCount: 5,
        aiChatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkAiReportLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(5);
    });
  });

  describe('checkAiChatLimit', () => {
    it('should allow chat when under limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 0,
        aiReportCount: 0,
        aiChatCount: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkAiChatLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(15);
      expect(result.limit).toBe(20);
    });

    it('should reject chat when at limit', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 0,
        aiReportCount: 0,
        aiChatCount: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usageService.checkAiChatLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(20);
    });
  });

  describe('incrementHealthScan', () => {
    it('should increment health scan count', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({});
      await usageService.incrementHealthScan(userId);
      expect(mockDb.userUsage.upsert).toHaveBeenCalled();
    });
  });

  describe('incrementAiReport', () => {
    it('should increment AI report count', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({});
      await usageService.incrementAiReport(userId);
      expect(mockDb.userUsage.upsert).toHaveBeenCalled();
    });
  });

  describe('incrementAiChat', () => {
    it('should increment AI chat count', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({});
      await usageService.incrementAiChat(userId);
      expect(mockDb.userUsage.upsert).toHaveBeenCalled();
    });
  });

  describe('checkRepositoryLimit', () => {
    it('should allow repository when under limit', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 2n }]);
      const result = await usageService.checkRepositoryLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(2);
      expect(result.limit).toBe(3);
    });

    it('should reject repository when at limit', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 3n }]);
      const result = await usageService.checkRepositoryLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(3);
    });
  });

  describe('getHealthCache', () => {
    it('should return cached health result', async () => {
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
    });

    it('should return null for cache miss', async () => {
      mockDb.repoHealthSnapshot.findUnique.mockResolvedValue(null);
      const result = await usageService.getHealthCache(userId, 'test-owner', 'test-repo', 'abc123');
      expect(result).toBeNull();
    });
  });

  describe('Usage period isolation', () => {
    it('should use current period for all operations', async () => {
      mockDb.userUsage.upsert.mockResolvedValue({
        id: '1',
        userId,
        period: getCurrentPeriod(),
        healthScanCount: 0,
        aiReportCount: 0,
        aiChatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await usageService.checkHealthScanLimit(userId);
      const callArgs = mockDb.userUsage.upsert.mock.calls[0][0];
      expect(callArgs.where.userId_period.period).toBe(getCurrentPeriod());
    });
  });
});
