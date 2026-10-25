import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '@/pages/dashboard';

// Counts auto-fetch attempts so the test can assert the effect settles instead
// of re-arming after every response.
const calls = vi.hoisted(() => ({ pulls: 0 }));

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'a@example.com',
      name: 'Alice',
      avatarUrl: null,
      role: 'user',
      authProvider: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    session: { accessToken: 'token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// The mock owns real React state so `loading` actually toggles between commits
// — that is what re-ran the auto-fetch effect in production.
vi.mock('@/hooks/use-github', async () => {
  const React = await import('react');
  return {
    useGitHub: () => {
      const [loading, setLoading] = React.useState(false);
      const [pulls, setPulls] = React.useState<unknown[]>([]);

      const fetchPulls = React.useCallback(async () => {
        calls.pulls += 1;
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        // The real endpoint answers `pulls: []` for this repo — a repo with no
        // open PRs is exactly what used to spin the loop.
        setPulls([]);
        setLoading(false);
      }, []);

      return {
        connected: true,
        githubUser: null,
        connectedAt: null,
        repositories: [{ full_name: 'sharadpawar05/Devpilot-AI' }],
        branches: [],
        pulls,
        files: [],
        loading,
        disconnecting: false,
        error: null,
        selectedRepoName: 'sharadpawar05/Devpilot-AI',
        selectedBranch: null,
        selectedPRNumber: null,
        connect: vi.fn(),
        handleCallback: vi.fn(),
        disconnect: vi.fn(),
        refreshConnection: vi.fn(),
        fetchRepositories: vi.fn(),
        fetchBranches: vi.fn(),
        fetchPulls,
        fetchFiles: vi.fn(),
        reviewPR: vi.fn(),
        analyzePR: vi.fn(),
        selectRepo: vi.fn(),
        selectBranch: vi.fn(),
        selectPR: vi.fn(),
      };
    },
  };
});

vi.mock('@/hooks/use-dashboard', () => ({
  useDashboard: () => ({
    data: {
      success: true,
      github: { connected: true, username: 'sharadpawar05', avatar: null, connectedAt: null },
      stats: { lastActivityAt: null },
      activity: [],
    },
    isLoading: false,
  }),
}));

vi.mock('@/lib/repo-overview', () => ({
  useRepoOverview: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/ai-history', () => ({
  aiHistoryApi: {
    listSessions: vi.fn(async () => ({
      sessions: [],
      pagination: { page: 1, pageSize: 100, total: 0, hasMore: false },
    })),
  },
  aiHistoryStorage: { clearAll: vi.fn(async () => undefined) },
}));

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/use-ai-credit-limit', () => ({
  useAiCreditLimit: () => ({
    exhausted: false,
    details: null,
    open: false,
    setOpen: vi.fn(),
    openLimit: vi.fn(),
  }),
}));

function Harness() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage auto-fetch', () => {
  afterEach(() => {
    cleanup();
    calls.pulls = 0;
  });

  it('fetches PRs once and settles when the repo has no open pull requests', async () => {
    render(<Harness />);

    await waitFor(() => expect(calls.pulls).toBeGreaterThan(0));

    // Give the effect every chance to re-arm: each response toggles `loading`
    // and commits `pulls: []`, which previously satisfied neither half of the
    // `fetched === repo && pulls.length > 0` guard.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(calls.pulls).toBe(1);
  });
});
