import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunHealthScan } from '@/lib/repo-intelligence';
import { repositoryIntelligenceApi } from '@/lib/repo-intelligence/api';
import { ApiError, getUsageLimitDetails } from '@/lib/api-error';
import type { RepositoryHealth } from '@/lib/repo-intelligence';

vi.mock('@/auth', () => ({
  useAuth: () => ({ session: { accessToken: 'test-token' } }),
}));

vi.mock('@/lib/repo-intelligence/api', () => ({
  repositoryIntelligenceApi: {
    getHealth: vi.fn(),
  },
}));

const getHealth = vi.mocked(repositoryIntelligenceApi.getHealth);

const health: RepositoryHealth = {
  score: 88,
  passedCount: 9,
  failedCount: 1,
  warningCount: 0,
  criticalCount: 0,
  details: [
    {
      id: 'readme',
      name: 'README present',
      category: 'structural',
      status: 'passed',
      passed: true,
      severity: 'low',
      failedDescription: '',
      whyItMatters: '',
      recommendation: '',
      estimatedEffort: '',
      actionLabel: 'none',
      actionType: 'none',
      scorePenalty: 0,
    },
  ],
  scoreBreakdown: [{ name: 'Structural', penalty: 0, category: 'structural' }],
  summary: { structuralScore: 95, qualityScore: 82, structuralWeight: 40, qualityWeight: 60 },
  updatedAt: '2026-09-25T00:00:00.000Z',
};

function ScanHarness() {
  const mutation = useRunHealthScan('octo', 'demo');
  const details = getUsageLimitDetails(mutation.error);

  return (
    <>
      <button onClick={() => mutation.mutateAsync().catch(() => undefined)}>run scan</button>
      <span data-testid="status">{mutation.status}</span>
      <span data-testid="cached">{String(mutation.data?.cached ?? 'n/a')}</span>
      <span data-testid="details">
        {details ? `${details.feature} ${details.used}/${details.limit}` : 'none'}
      </span>
    </>
  );
}

describe('useRunHealthScan', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    cleanup();
  });

  function renderHarness() {
    return render(
      <QueryClientProvider client={client}>
        <ScanHarness />
      </QueryClientProvider>,
    );
  }

  it('runs an uncached scan and invalidates the usage meter', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    getHealth.mockResolvedValue({ success: true, data: health, cached: false });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'run scan' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'));

    expect(getHealth).toHaveBeenCalledWith('octo', 'demo', 'test-token');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['usage'] });
    expect(screen.getByTestId('cached')).toHaveTextContent('false');
    expect(client.getQueryData(['repo-intelligence', 'health', 'octo', 'demo'])).toEqual(health);
  });

  it('does not invalidate the usage meter for cached results', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    getHealth.mockResolvedValue({ success: true, data: health, cached: true });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'run scan' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'));

    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByTestId('cached')).toHaveTextContent('true');
  });

  it('keeps the usage-limit envelope so the modal can render plan details', async () => {
    getHealth.mockRejectedValue(
      new ApiError('Health scan limit reached. Your plan includes 2 scans per month.', {
        code: 'USAGE_LIMIT_REACHED',
        feature: 'HEALTH_SCAN',
        used: 2,
        limit: 2,
        resetAt: '2026-10-01T00:00:00.000Z',
      }),
    );

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'run scan' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('details')).toHaveTextContent('HEALTH_SCAN 2/2');
  });

  it('surfaces a plain failure when the scan request errors', async () => {
    getHealth.mockResolvedValue({ success: false, error: 'Failed to fetch health' });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'run scan' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('details')).toHaveTextContent('none');
  });
});
