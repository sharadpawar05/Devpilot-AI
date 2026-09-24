import { describe, it, expect } from 'vitest';
import { ApiError, isUsageLimitError, getUsageLimitDetails, toApiError } from '@/lib/api-error';
import { UsageLimitModal } from '@/components/UsageLimitModal';

const usageError = new ApiError(
  'Engineering report limit reached. Your plan includes 2 reports per month.',
  {
    code: 'USAGE_LIMIT_REACHED',
    feature: 'AI_REPORT',
    used: 2,
    limit: 2,
    resetAt: '2026-10-01T00:00:00.000Z',
    retryable: false,
  },
);

describe('api-error', () => {
  it('detects USAGE_LIMIT_REACHED on ApiError', () => {
    expect(isUsageLimitError(usageError)).toBe(true);
  });

  it('detects PLAN_LIMIT_REACHED code', () => {
    expect(isUsageLimitError({ code: 'PLAN_LIMIT_REACHED', message: 'limit' })).toBe(true);
  });

  it('returns false for non-usage errors', () => {
    expect(isUsageLimitError(new Error('network fail'))).toBe(false);
    expect(isUsageLimitError({ code: 'AI_ERROR', message: 'boom' })).toBe(false);
  });

  it('extracts usage limit details', () => {
    const details = getUsageLimitDetails(usageError);
    expect(details).toMatchObject({
      feature: 'AI_REPORT',
      used: 2,
      limit: 2,
      resetAt: '2026-10-01T00:00:00.000Z',
    });
    expect(details?.message).toContain('Engineering report limit reached');
  });

  it('falls back to feature inference from message when fields missing', () => {
    const details = getUsageLimitDetails({
      message: 'Your plan includes 1 active repository. Upgrade to use another repository.',
    });
    expect(details?.feature).toBe('REPOSITORIES');
    expect(details?.limit).toBe(1);
    expect(details?.used).toBe(1);
  });

  it('recovers limit and used from server message when envelope fields are dropped', () => {
    const details = getUsageLimitDetails({
      code: 'USAGE_LIMIT_REACHED',
      message:
        'Engineering report limit reached. Your plan includes 2 reports per month. Upgrade to generate more reports.',
    });
    expect(details).toMatchObject({ feature: 'AI_REPORT', used: 2, limit: 2 });
  });

  it('reads numeric fields from nested error objects', () => {
    const details = getUsageLimitDetails({
      response: {
        error: {
          code: 'USAGE_LIMIT_REACHED',
          message: 'limit reached',
          feature: 'AI_CREDITS',
          used: 50,
          limit: 50,
        },
      },
    });
    expect(details).toMatchObject({ feature: 'AI_CREDITS', used: 50, limit: 50 });
  });

  it('preserves fields via toApiError', () => {
    const err = toApiError(
      {
        message: 'limit reached',
        code: 'USAGE_LIMIT_REACHED',
        feature: 'AI_CREDITS',
        used: 50,
        limit: 50,
        resetAt: '2026-11-01T00:00:00.000Z',
      },
      'fallback',
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('USAGE_LIMIT_REACHED');
    expect(err.feature).toBe('AI_CREDITS');
    expect(err.used).toBe(50);
    expect(err.limit).toBe(50);
    expect(err.resetAt).toBe('2026-11-01T00:00:00.000Z');
    expect(err.message).toBe('limit reached');
  });
});

describe('UsageLimitModal', () => {
  it('exports a memoized component', () => {
    expect(UsageLimitModal).toBeTruthy();
    expect(typeof UsageLimitModal).toBe('object');
  });
});
