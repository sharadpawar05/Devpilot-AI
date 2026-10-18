import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCachedHealth = vi.fn();
const getLatestCommitSha = vi.fn();
const getHealthMeta = vi.fn();
const getHealth = vi.fn();

vi.mock('@/features/repo-intelligence/repository-service', () => ({
  repositoryIntelligenceService: {
    getCachedHealth: (...args: unknown[]) => getCachedHealth(...args),
    getLatestCommitSha: (...args: unknown[]) => getLatestCommitSha(...args),
    getHealthMeta: (...args: unknown[]) => getHealthMeta(...args),
    getHealth: (...args: unknown[]) => getHealth(...args),
  },
}));

const getHealthCache = vi.fn();
const consumeQuota = vi.fn();
const refundQuota = vi.fn();
const saveHealthCache = vi.fn();

vi.mock('@/core/usage', () => ({
  usageService: {
    getHealthCache: (...args: unknown[]) => getHealthCache(...args),
    consumeQuota: (...args: unknown[]) => consumeQuota(...args),
    refundQuota: (...args: unknown[]) => refundQuota(...args),
    saveHealthCache: (...args: unknown[]) => saveHealthCache(...args),
  },
  UsageLimitExceededError: class UsageLimitExceededError extends Error {
    details: unknown;
    constructor(details: unknown) {
      super('USAGE_LIMIT_REACHED');
      this.name = 'UsageLimitExceededError';
      this.details = details;
    }
  },
  sendUsageLimitReached: vi.fn(),
}));

import { getMeteredHealth } from '@/features/repo-intelligence/health-metering';
import { UsageLimitExceededError } from '@/core/usage';

const snapshotRow = {
  score: 82,
  passedCount: 10,
  failedCount: 2,
  criticalCount: 1,
  structuralScore: 85,
  qualityScore: 78,
  details: [],
  scoreBreakdown: [],
  summary: {},
  createdAt: new Date(),
};

const freshHealth = {
  score: 82,
  passedCount: 10,
  failedCount: 2,
  warningCount: 0,
  notMeasuredCount: 0,
  criticalCount: 1,
  details: [],
  scoreBreakdown: [],
  summary: { structuralScore: 85, qualityScore: 78 },
};

describe('getMeteredHealth (health scan cache behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedHealth.mockReturnValue(null);
    getLatestCommitSha.mockResolvedValue(null);
    getHealthMeta.mockResolvedValue({ updatedAt: new Date().toISOString(), trend: null });
    getHealth.mockResolvedValue(freshHealth);
    getHealthCache.mockResolvedValue(null);
    consumeQuota.mockResolvedValue({
      allowed: true,
      consumed: true,
      used: 1,
      limit: 2,
      remaining: 1,
      resetAt: new Date(),
    });
    refundQuota.mockResolvedValue(undefined);
    saveHealthCache.mockResolvedValue({});
  });

  it('serves the warm in-memory cache without consuming a scan', async () => {
    getCachedHealth.mockReturnValue(freshHealth);

    const result = await getMeteredHealth('user-a', 'acme', 'demo');

    expect(result.cached).toBe(true);
    expect(result.health).toBe(freshHealth);
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(getHealthCache).not.toHaveBeenCalled();
    expect(getHealth).not.toHaveBeenCalled();
  });

  it('serves a fresh DB snapshot (per commit SHA) without consuming a scan', async () => {
    getLatestCommitSha.mockResolvedValue('sha1');
    getHealthCache.mockResolvedValue({ ...snapshotRow, createdAt: new Date() });

    const result = await getMeteredHealth('user-a', 'acme', 'demo');

    expect(result.cached).toBe(true);
    expect(result.health.score).toBe(82);
    expect(getHealthCache).toHaveBeenCalledWith('user-a', 'acme', 'demo', 'sha1');
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(getHealth).not.toHaveBeenCalled();
  });

  it('looks up the snapshot by the CURRENT commit SHA and rescans when that SHA is not stored', async () => {
    // A snapshot exists for an older commit; the cache lookup for the new
    // SHA returns nothing, so the scan must be re-run (and charged).
    getLatestCommitSha.mockResolvedValue('sha-new');
    getHealthCache.mockResolvedValue(null);

    const result = await getMeteredHealth('user-a', 'acme', 'demo');

    expect(getHealthCache).toHaveBeenCalledWith('user-a', 'acme', 'demo', 'sha-new');
    expect(result.cached).toBe(false);
    expect(consumeQuota).toHaveBeenCalledWith('user-a', 'HEALTH_SCAN');
    expect(getHealth).toHaveBeenCalledWith('user-a', 'acme', 'demo');
    expect(saveHealthCache).toHaveBeenCalledWith(
      'user-a',
      'acme',
      'demo',
      'sha-new',
      expect.objectContaining({ score: 82 }),
    );
  });

  it('consumes one HEALTH_SCAN and saves a snapshot when the cache is stale', async () => {
    getLatestCommitSha.mockResolvedValue('sha1');
    getHealthCache.mockResolvedValue({
      ...snapshotRow,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    const result = await getMeteredHealth('user-a', 'acme', 'demo');

    expect(result.cached).toBe(false);
    expect(consumeQuota).toHaveBeenCalledWith('user-a', 'HEALTH_SCAN');
    expect(getHealth).toHaveBeenCalledWith('user-a', 'acme', 'demo');
    expect(saveHealthCache).toHaveBeenCalledWith(
      'user-a',
      'acme',
      'demo',
      'sha1',
      expect.objectContaining({ score: 82 }),
    );
  });

  it('consumes on a cache miss and skips the snapshot save when there is no commit SHA', async () => {
    const result = await getMeteredHealth('user-a', 'acme', 'demo');

    expect(result.cached).toBe(false);
    expect(consumeQuota).toHaveBeenCalledWith('user-a', 'HEALTH_SCAN');
    expect(saveHealthCache).not.toHaveBeenCalled();
  });

  it('throws UsageLimitExceededError with machine-readable details when the limit is reached', async () => {
    const details = { feature: 'HEALTH_SCAN', used: 2, limit: 2, resetAt: new Date() };
    consumeQuota.mockResolvedValue({
      allowed: false,
      consumed: false,
      used: 2,
      limit: 2,
      remaining: 0,
      resetAt: details.resetAt,
      details,
    });

    const error = await getMeteredHealth('user-a', 'acme', 'demo').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UsageLimitExceededError);
    expect((error as InstanceType<typeof UsageLimitExceededError>).details).toMatchObject({
      feature: 'HEALTH_SCAN',
      used: 2,
      limit: 2,
    });
    expect(getHealth).not.toHaveBeenCalled();
    expect(refundQuota).not.toHaveBeenCalled();
  });

  it('refunds the consumed scan when the underlying scan fails', async () => {
    getHealth.mockRejectedValue(new Error('provider down'));

    const error = await getMeteredHealth('user-a', 'acme', 'demo').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('provider down');
    expect(refundQuota).toHaveBeenCalledWith('user-a', 'HEALTH_SCAN');
    expect(saveHealthCache).not.toHaveBeenCalled();
  });
});
