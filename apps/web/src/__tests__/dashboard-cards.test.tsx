import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceStatus } from '@/components/dashboard/WorkspaceStatus';
import { UsageAnalytics } from '@/components/dashboard/UsageAnalytics';
import { HealthSnapshotCard } from '@/components/dashboard/HealthSnapshotCard';
import type { RepoHealthCheck } from '@/lib/repo-overview';

function healthFixture(overrides: Partial<RepoHealthCheck> = {}): RepoHealthCheck {
  return {
    score: 72,
    passedCount: 12,
    failedCount: 2,
    warningCount: 1,
    criticalCount: 0,
    notMeasuredCount: 1,
    details: [],
    scoreBreakdown: [],
    summary: {
      structuralScore: 80,
      qualityScore: 66,
      structuralWeight: 40,
      qualityWeight: 60,
    },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WorkspaceStatus', () => {
  afterEach(() => cleanup());

  it('shows workspace state without implementation details', () => {
    render(
      <MemoryRouter>
        <WorkspaceStatus pendingPRReviews={2} githubConnected={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Workspace Status')).toBeInTheDocument();
    expect(screen.getByText('PR Reviews Pending')).toBeInTheDocument();
    expect(screen.getByText('GitHub Status')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Last AI Model')).toBeNull();
  });
});

describe('UsageAnalytics', () => {
  afterEach(() => cleanup());

  it('focuses on workspace activity instead of repeating quota data', () => {
    render(
      <UsageAnalytics
        aiRequestsToday={4}
        codeReviews={7}
        avgReviewTime="12s"
        githubRepos={3}
        openPRs={2}
        connectedSince="2026-08-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByText('Workspace Overview')).toBeInTheDocument();
    expect(screen.queryByText('Usage')).toBeNull();
    expect(screen.getByText('Code Reviews')).toBeInTheDocument();
    expect(screen.queryByText('Total Reviews')).toBeNull();
    expect(screen.getByText('Requests Today')).toBeInTheDocument();
    expect(screen.getByText('Avg Response')).toBeInTheDocument();
    expect(screen.queryByText('AI Credits')).toBeNull();
    expect(screen.getByText('Open PRs')).toBeInTheDocument();
    expect(screen.getByText('Repos')).toBeInTheDocument();
  });
});

describe('HealthSnapshotCard', () => {
  afterEach(() => cleanup());

  function renderCard(health: RepoHealthCheck) {
    return render(
      <MemoryRouter>
        <HealthSnapshotCard
          repoFullName="acme/api"
          health={health}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );
  }

  it('labels an unchanged score trend as no change', () => {
    renderCard(
      healthFixture({
        trend: {
          score: { current: 72, previous: 72, change: 0, direction: 'stable' },
          coverage: null,
          previousAt: '2026-08-01T00:00:00.000Z',
        },
      }),
    );

    expect(screen.getByText('Engineering Health')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('· No change')).toBeInTheDocument();
    expect(screen.getByText('12 passed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full health report/i })).toBeInTheDocument();
  });

  it('labels a score change in points', () => {
    renderCard(
      healthFixture({
        trend: {
          score: { current: 72, previous: 69, change: 3, direction: 'up' },
          coverage: null,
          previousAt: '2026-08-01T00:00:00.000Z',
        },
      }),
    );

    expect(screen.getByText('+3 pts')).toBeInTheDocument();
    expect(screen.queryByText('· No change')).toBeNull();
  });

  it('renders a usage-limit error once with Upgrade and no Retry button', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <HealthSnapshotCard
          repoFullName="acme/api"
          health={null}
          isLoading={false}
          error={{
            message: 'Health scan limit reached. Your plan includes 2 scans per month.',
            retryable: false,
            resetAt: '2026-11-01T00:00:00.000Z',
          }}
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );

    // Message rendered exactly once.
    expect(screen.getAllByText(/Health scan limit reached/)).toHaveLength(1);
    // Non-retryable: Upgrade CTA, no Retry button.
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    // Reset date surfaced.
    expect(screen.getByText(/Resets/)).toBeInTheDocument();
  });
});
