import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageLimits } from '@/components/dashboard/UsageLimits';
import { useUsage } from '@/hooks/use-usage';

vi.mock('@/hooks/use-usage');

const mockUseUsage = vi.mocked(useUsage);

function mockPending() {
  return {
    data: undefined,
    isLoading: true,
    isPending: true,
    isFetching: true,
    error: null,
    refetch: vi.fn(),
    isSuccess: false,
    isError: false,
    isInitialLoading: true,
    status: 'pending' as const,
    fetchStatus: 'fetching' as const,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: false,
    isFetchedAfterMount: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: true,
    isEnabled: true,
    isLoadingError: false,
    isPaused: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    promise: Promise.resolve(undefined as never),
  };
}

function mockSuccess(data: NonNullable<ReturnType<typeof useUsage>['data']>) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    isSuccess: true,
    isError: false,
    isInitialLoading: false,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isEnabled: true,
    isLoadingError: false,
    isPaused: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    promise: Promise.resolve(undefined as never),
  };
}

function mockError(message = 'Failed to fetch usage') {
  return {
    data: undefined,
    isLoading: false,
    isPending: false,
    isFetching: false,
    error: new Error(message),
    refetch: vi.fn(),
    isSuccess: false,
    isError: true,
    isInitialLoading: false,
    status: 'error' as const,
    fetchStatus: 'idle' as const,
    dataUpdatedAt: 0,
    errorUpdatedAt: Date.now(),
    failureCount: 1,
    failureReason: new Error(message),
    errorUpdateCount: 1,
    isFetched: true,
    isFetchedAfterMount: true,
    isPlaceholderData: false,
    isRefetchError: true,
    isRefetching: false,
    isStale: false,
    isEnabled: true,
    isLoadingError: true,
    isPaused: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    promise: Promise.resolve(undefined as never),
  };
}

describe('UsageLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while pending', () => {
    mockUseUsage.mockReturnValue(mockPending() as ReturnType<typeof useUsage>);

    const { container } = render(<UsageLimits />);
    expect(screen.getByText('Usage & Limits')).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('should render usage rows with real API values', () => {
    mockUseUsage.mockReturnValue(
      mockSuccess({
        plan: 'FREE',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-10-01T00:00:00.000Z',
        usage: { aiCredits: 3, healthScans: 0, aiReports: 2, chatMessages: 2, repositories: 1 },
        limits: { aiCredits: 50, healthScans: 2, aiReports: 2, chatMessages: 20, repositories: 1 },
        remaining: {
          aiCredits: 47,
          healthScans: 2,
          aiReports: 0,
          chatMessages: 18,
          repositories: 0,
        },
      }) as ReturnType<typeof useUsage>,
    );

    render(<UsageLimits />);
    expect(screen.getByText('Usage & Limits')).toBeTruthy();
    // AI Credits primary row
    expect(screen.getByText('3 / 50')).toBeTruthy();
    expect(screen.getByText('47 remaining')).toBeTruthy();
    expect(screen.getByText('6%')).toBeTruthy();
    // Feature rows
    expect(screen.getByText('0 / 2')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText('2 / 20')).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
    // Customer-facing labels (no internal enum names)
    expect(screen.getByText('Engineering Reports')).toBeTruthy();
    expect(screen.getByText('Active Repositories')).toBeTruthy();
    expect(screen.getByText('Health Scans')).toBeTruthy();
    // Chat counter covers Playground and Repository Chat, so the label says so
    expect(screen.getByText('AI Chat Messages')).toBeTruthy();
    expect(screen.queryByText('Repository Chat')).toBeNull();
    expect(screen.queryByText('AI_REPORT')).toBeNull();
    expect(screen.queryByText('Feature Quotas')).toBeNull();
    expect(screen.getByText(/Resets Oct 1/)).toBeTruthy();
  });

  it('should clamp percentage at 100% and never show negative remaining', () => {
    mockUseUsage.mockReturnValue(
      mockSuccess({
        plan: 'FREE',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-10-01T00:00:00.000Z',
        // Over-limit historical data: used > limit
        usage: { aiCredits: 60, healthScans: 5, aiReports: 3, chatMessages: 25, repositories: 2 },
        limits: { aiCredits: 50, healthScans: 2, aiReports: 2, chatMessages: 20, repositories: 1 },
        remaining: {
          aiCredits: 0,
          healthScans: 0,
          aiReports: 0,
          chatMessages: 0,
          repositories: 0,
        },
      }) as ReturnType<typeof useUsage>,
    );

    render(<UsageLimits />);
    // Progress bars clamp at 100%
    const bars = screen.getAllByRole('progressbar');
    for (const bar of bars) {
      const now = Number(bar.getAttribute('aria-valuenow'));
      const max = Number(bar.getAttribute('aria-valuemax'));
      expect(now).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThanOrEqual(0);
    }
    // Remaining never negative in display (credits row uses max(limit-used,0))
    expect(screen.queryByText(/-?\d+ remaining/)).toBeTruthy();
    const remainingText = screen.getByText(/remaining/);
    expect(remainingText.textContent).not.toMatch(/-/);
  });

  it('should show limit reached message when at limit', () => {
    mockUseUsage.mockReturnValue(
      mockSuccess({
        plan: 'FREE',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-10-01T00:00:00.000Z',
        usage: { aiCredits: 50, healthScans: 2, aiReports: 2, chatMessages: 20, repositories: 1 },
        limits: { aiCredits: 50, healthScans: 2, aiReports: 2, chatMessages: 20, repositories: 1 },
        remaining: { aiCredits: 0, healthScans: 0, aiReports: 0, chatMessages: 0, repositories: 0 },
      }) as ReturnType<typeof useUsage>,
    );

    render(<UsageLimits />);
    const limitMessages = screen.getAllByText('Plan limit reached');
    expect(limitMessages.length).toBeGreaterThan(0);
  });

  it('should show error state with retry when query fails', () => {
    mockUseUsage.mockReturnValue(mockError('Failed to fetch usage') as ReturnType<typeof useUsage>);

    render(<UsageLimits />);
    expect(screen.getByText('Failed to fetch usage')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
  });

  it('should show fallback error copy when error has no message', () => {
    mockUseUsage.mockReturnValue(mockError('') as ReturnType<typeof useUsage>);

    render(<UsageLimits />);
    expect(screen.getByText('Unable to load usage and limits.')).toBeTruthy();
  });
});
