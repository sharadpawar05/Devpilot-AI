import { vi } from 'vitest';
import type { UsageData } from '@/hooks/use-usage';

type UsageQueryResult = ReturnType<(typeof import('@/hooks/use-usage'))['useUsage']>;

export function usageQuerySuccess(data: UsageData): UsageQueryResult {
  return {
    data,
    isPending: false,
    isFetching: false,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isSuccess: true,
    status: 'success',
    fetchStatus: 'idle',
  } as unknown as UsageQueryResult;
}

export function usageQueryPending(): UsageQueryResult {
  return {
    data: undefined,
    isPending: true,
    isFetching: true,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isSuccess: false,
    status: 'pending',
    fetchStatus: 'fetching',
  } as unknown as UsageQueryResult;
}

export function usageQueryError(message: string): UsageQueryResult {
  return {
    data: undefined,
    isPending: false,
    isFetching: false,
    isLoading: false,
    isError: true,
    error: new Error(message),
    refetch: vi.fn(),
    isSuccess: false,
    status: 'error',
    fetchStatus: 'idle',
  } as unknown as UsageQueryResult;
}

export function usageFixture(overrides: {
  usage?: Partial<UsageData['usage']>;
  limits?: Partial<UsageData['limits']>;
  remaining?: Partial<UsageData['remaining']>;
  periodEnd?: string;
  plan?: string;
}): UsageData {
  return {
    plan: overrides.plan ?? 'FREE',
    periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: overrides.periodEnd ?? '2026-10-01T00:00:00.000Z',
    usage: {
      aiCredits: 3,
      healthScans: 0,
      aiReports: 0,
      chatMessages: 2,
      repositories: 1,
      ...overrides.usage,
    },
    limits: {
      aiCredits: 50,
      healthScans: 2,
      aiReports: 2,
      chatMessages: 20,
      repositories: 1,
      ...overrides.limits,
    },
    remaining: {
      aiCredits: 47,
      healthScans: 2,
      aiReports: 2,
      chatMessages: 18,
      repositories: 0,
      ...overrides.remaining,
    },
  };
}
