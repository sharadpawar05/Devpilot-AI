import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { repoOverviewApi } from '@/lib/repo-overview/api';
import { ApiError, getUsageLimitDetails } from '@/lib/api-error';
import { getErrorMessage } from '@/lib/error-messages';

const usageEnvelope = {
  success: false,
  error: {
    code: 'USAGE_LIMIT_REACHED',
    message:
      'Health scan limit reached. Your plan includes 2 scans per month. Upgrade or wait until reset.',
    feature: 'HEALTH_SCAN',
    used: 2,
    limit: 2,
    resetAt: '2026-11-01T00:00:00.000Z',
  },
};

describe('repoOverviewApi.getOverview', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('propagates the USAGE_LIMIT_REACHED envelope instead of flattening it', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => JSON.stringify(usageEnvelope),
    });

    const error = await repoOverviewApi
      .getOverview('sharadpawar05', 'Devpilot-AI', 'token')
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('USAGE_LIMIT_REACHED');
    expect(apiError.feature).toBe('HEALTH_SCAN');
    expect(apiError.used).toBe(2);
    expect(apiError.limit).toBe(2);
    expect(apiError.resetAt).toBe('2026-11-01T00:00:00.000Z');
    expect(apiError.message).toContain('2 scans per month');
  });

  it('keeps enough detail for the error card copy', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => JSON.stringify(usageEnvelope),
    });

    const apiError = (await repoOverviewApi
      .getOverview('sharadpawar05', 'Devpilot-AI', 'token')
      .catch((err: unknown) => err)) as ApiError;

    expect(getUsageLimitDetails(apiError)).toMatchObject({
      feature: 'HEALTH_SCAN',
      used: 2,
      limit: 2,
    });

    const copy = getErrorMessage(apiError);
    expect(copy.title).toBe('Health scan limit reached');
    expect(copy.message).toContain(
      'Health scan limit reached. Your plan includes 2 scans per month',
    );
    expect(copy.suggestion).toBe('Repository health analyses for the current billing period.');
    expect(copy.retryable).toBe(false);
  });
});
