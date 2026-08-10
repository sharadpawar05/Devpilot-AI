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
    error: null,
    refetch: vi.fn(),
    isPending: true,
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
    isFetching: true,
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

function mockSuccess(data: ReturnType<typeof useUsage>['data']) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isPending: false,
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
    isFetching: false,
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

describe('UsageLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when loading', () => {
    mockUseUsage.mockReturnValue(mockPending() as ReturnType<typeof useUsage>);

    const { container } = render(<UsageLimits />);
    expect(container.firstChild).toBeNull();
  });

  it('should render usage data', () => {
    mockUseUsage.mockReturnValue(
      mockSuccess({
        plan: 'free',
        period: '2026-08',
        repositories: { used: 2, limit: 3 },
        healthScans: { used: 3, limit: 5 },
        aiReports: { used: 1, limit: 5 },
        aiChat: { used: 10, limit: 20 },
      }) as ReturnType<typeof useUsage>,
    );

    render(<UsageLimits />);
    expect(screen.getByText('Usage this month')).toBeTruthy();
    expect(screen.getByText('3 / 5')).toBeTruthy();
    expect(screen.getByText('1 / 5')).toBeTruthy();
    expect(screen.getByText('10 / 20')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('should show limit reached message when at limit', () => {
    mockUseUsage.mockReturnValue(
      mockSuccess({
        plan: 'free',
        period: '2026-08',
        repositories: { used: 3, limit: 3 },
        healthScans: { used: 5, limit: 5 },
        aiReports: { used: 5, limit: 5 },
        aiChat: { used: 20, limit: 20 },
      }) as ReturnType<typeof useUsage>,
    );

    render(<UsageLimits />);
    const limitMessages = screen.getAllByText('Free plan limit reached');
    expect(limitMessages.length).toBeGreaterThan(0);
  });
});
