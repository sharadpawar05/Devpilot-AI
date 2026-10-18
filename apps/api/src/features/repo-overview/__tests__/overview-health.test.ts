import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMeteredHealth = vi.fn();

vi.mock('@/features/repo-intelligence/health-metering', () => ({
  getMeteredHealth: (...args: unknown[]) => getMeteredHealth(...args),
}));

const getMetadata = vi.fn();
const getLanguages = vi.fn();
const getContributors = vi.fn();
const getFileTree = vi.fn();

vi.mock('@/features/repo-intelligence', () => ({
  repositoryIntelligenceService: {
    getMetadata: (...args: unknown[]) => getMetadata(...args),
    getLanguages: (...args: unknown[]) => getLanguages(...args),
    getContributors: (...args: unknown[]) => getContributors(...args),
    getFileTree: (...args: unknown[]) => getFileTree(...args),
  },
}));

vi.mock('@/core/usage', () => ({
  UsageLimitExceededError: class UsageLimitExceededError extends Error {
    details: unknown;
    constructor(details: unknown) {
      super('USAGE_LIMIT_REACHED');
      this.name = 'UsageLimitExceededError';
      this.details = details;
    }
  },
  usageService: {},
  sendUsageLimitReached: vi.fn(),
}));

import { repoOverviewService } from '../overview-service';
import { UsageLimitExceededError } from '@/core/usage';
import type { RepositoryHealth } from '@/features/repo-intelligence';

const metadata = {
  id: 1,
  name: 'demo',
  full_name: 'acme/demo',
  description: 'demo repo',
  html_url: 'https://github.com/acme/demo',
  default_branch: 'main',
  visibility: 'public',
  size: 1024,
  stargazers_count: 5,
  forks_count: 2,
  open_issues_count: 1,
  watchers_count: 3,
  language: 'TypeScript',
  license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
  topics: ['cli'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pushed_at: '2026-01-01T00:00:00Z',
  owner: { login: 'acme', avatar_url: '', type: 'User' },
} as never;

const canonicalHealth: RepositoryHealth = {
  score: 73,
  passedCount: 9,
  failedCount: 2,
  warningCount: 1,
  notMeasuredCount: 3,
  criticalCount: 0,
  details: [
    {
      id: 'complexity',
      name: 'Code Complexity & File Size',
      category: 'quality',
      status: 'not_measured',
      passed: false,
      severity: 'low',
      failedDescription: 'No source file contents available to analyze complexity',
      whyItMatters: 'Large files are harder to maintain.',
      recommendation: 'Retry the scan.',
      estimatedEffort: '2-4 hours',
      actionLabel: 'Review Complexity',
      actionType: 'none',
      scorePenalty: 0,
    },
    {
      id: 'readme',
      name: 'README present',
      category: 'structural',
      status: 'passed',
      passed: true,
      severity: 'low',
      failedDescription: 'README.md exists',
      whyItMatters: 'Docs matter.',
      recommendation: 'Keep it updated.',
      estimatedEffort: '30-60 minutes',
      actionLabel: 'Improve README',
      actionType: 'improve-readme',
      scorePenalty: 0,
    },
  ],
  scoreBreakdown: [{ name: 'Dependencies', penalty: 12, category: 'quality' }],
  summary: {
    structuralScore: 80,
    qualityScore: 68,
    structuralWeight: 40,
    qualityWeight: 60,
    complexityScore: null,
    maintainabilityScore: null,
  },
  updatedAt: '2026-10-18T00:00:00.000Z',
  trend: null,
};

describe('repo overview health consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMetadata.mockResolvedValue(metadata);
    getLanguages.mockResolvedValue({ TypeScript: 1000 });
    getContributors.mockResolvedValue([]);
    getFileTree.mockResolvedValue([]);
    getMeteredHealth.mockResolvedValue({ health: canonicalHealth, cached: false });
  });

  it('passes the canonical metered health through unchanged (same summary object)', async () => {
    const data = await repoOverviewService.getOverview('user-1', 'acme', 'demo');

    expect(getMeteredHealth).toHaveBeenCalledWith('user-1', 'acme', 'demo');
    expect(data.health.score).toBe(73);
    expect(data.health.summary).toBe(canonicalHealth.summary);
    expect(data.health.summary.structuralWeight).toBe(40);
    expect(data.health.summary.qualityWeight).toBe(60);
    expect(data.health.details.map((d) => d.id)).toEqual(['complexity', 'readme']);
    expect(data.health.details[0].status).toBe('not_measured');
    expect(data.health.notMeasuredCount).toBe(3);
    expect(data.health.trend).toBeNull();
  });

  it('fails the request when the health scan fails — never serves a fabricated score of 0', async () => {
    getMeteredHealth.mockRejectedValue(new Error('GitHub returned 502'));

    await expect(repoOverviewService.getOverview('user-1', 'acme', 'demo')).rejects.toThrow(
      'GitHub returned 502',
    );
  });

  it('propagates UsageLimitExceededError so routes can return the usage envelope', async () => {
    const details = { feature: 'HEALTH_SCAN' as const, used: 10, limit: 10, resetAt: new Date() };
    getMeteredHealth.mockRejectedValue(new UsageLimitExceededError(details));

    const error = await repoOverviewService
      .getOverview('user-1', 'acme', 'demo')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UsageLimitExceededError);
    expect((error as InstanceType<typeof UsageLimitExceededError>).details).toMatchObject({
      feature: 'HEALTH_SCAN',
      used: 10,
      limit: 10,
    });
  });

  it('allows the explicitly opted-in degraded path (internal AI summary) to still load metadata', async () => {
    getMeteredHealth.mockRejectedValue(
      new UsageLimitExceededError({
        feature: 'HEALTH_SCAN',
        used: 10,
        limit: 10,
        resetAt: new Date(),
      }),
    );

    const data = await repoOverviewService.getOverview('user-1', 'acme', 'demo', {
      allowDegradedHealth: true,
    });

    expect(data.metadata.full_name).toBe('acme/demo');
    // Placeholder health is only reachable behind allowDegradedHealth and is
    // never surfaced by GET /repo-overview/overview.
    expect(data.health.score).toBe(0);
    expect(data.health.details).toEqual([]);
  });
});
