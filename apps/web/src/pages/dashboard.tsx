import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useDashboard } from '@/hooks/use-dashboard';
import { useRepoOverview } from '@/lib/repo-overview';
import { HeroSection } from '@/components/dashboard/HeroSection';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { GitHubWidget } from '@/components/dashboard/GitHubWidget';
import { UsageAnalytics } from '@/components/dashboard/UsageAnalytics';
import { UsageLimits } from '@/components/dashboard/UsageLimits';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { WorkspaceStatus } from '@/components/dashboard/WorkspaceStatus';
import { TipsCard } from '@/components/dashboard/TipsCard';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { HealthSnapshotCard } from '@/components/dashboard/HealthSnapshotCard';
import { NeedsAttentionCard } from '@/components/dashboard/NeedsAttentionCard';
import { DashboardFullSkeleton } from '@/components/dashboard/skeletons';
import { aiHistoryApi } from '@/lib/ai-history';
import { getErrorMessage } from '@/lib/error-messages';

export function DashboardPage() {
  const { user, session } = useAuth();
  const token = session?.accessToken;
  const gh = useGitHub();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(token);

  // Server-side MAX(createdAt) from GET /dashboard. React Query refetches this
  // key on invalidation (e.g. after AI actions), so lastActive stays fresh.
  const lastActivityAt = dashboardData?.stats?.lastActivityAt ?? null;
  const fetchedPRsForRepo = useRef<string | null>(null);
  const [stats, setStats] = useState({
    aiRequestsToday: 0,
    codeReviews: 0,
    avgReviewTime: '—',
    lastSyncedAt: null as string | null,
    lastActivityAt: null as string | null,
  });

  const activeRepoFullName = useMemo(() => {
    return gh.selectedRepoName || gh.repositories[0]?.full_name || null;
  }, [gh.selectedRepoName, gh.repositories]);

  const [healthOwner, healthRepo] = useMemo(() => {
    if (!activeRepoFullName) return ['', ''];
    const [owner, repo] = activeRepoFullName.split('/');
    return [owner || '', repo || ''];
  }, [activeRepoFullName]);

  const {
    data: overview,
    isLoading: healthLoading,
    isError: healthIsError,
    error: healthError,
    refetch: refetchHealth,
  } = useRepoOverview(healthOwner, healthRepo);

  // Single structured error surfaced once. Usage-limit failures are non-retryable
  // and carry a resetAt so the card can offer Upgrade instead of a pointless Retry.
  const healthErrorMessage = useMemo(() => {
    if (!healthIsError || !healthError) return null;
    const config = getErrorMessage({
      message: healthError.message,
    });
    const isLimit =
      healthError.message.toLowerCase().includes('limit reached') ||
      /includes \d+ .* per month|includes \d+ active repository/i.test(healthError.message);
    return {
      message: config.message,
      retryable: isLimit ? false : (config.retryable ?? true),
      resetAt: null as string | null,
    };
  }, [healthIsError, healthError]);

  useEffect(() => {
    if (!token) return;

    const loadStats = async () => {
      try {
        const result = await aiHistoryApi.listSessions(token, {}, { page: 1, pageSize: 100 });
        const sessions = result.sessions;
        const reviewSessions = sessions.filter(
          (s) => s.workflowType === 'code-review' || s.workflowType === 'pr-review',
        );
        const reviewLatency = reviewSessions.reduce((sum, s) => sum + s.totalLatency, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter((s) => new Date(s.createdAt) >= today);

        const avgReviewMs = reviewSessions.length > 0 ? reviewLatency / reviewSessions.length : 0;

        setStats((prev) => ({
          ...prev,
          aiRequestsToday: todaySessions.length,
          codeReviews: reviewSessions.length,
          avgReviewTime:
            reviewSessions.length === 0
              ? '—'
              : avgReviewMs < 1000
                ? '< 1s'
                : `${Math.round(avgReviewMs / 1000)}s`,
          lastSyncedAt: gh.connected ? new Date().toISOString() : null,
          // lastActivityAt comes from the server (MAX(createdAt)); sessions[0] is
          // pinned-first, not most-recent, so it is not a valid fallback here.
        }));
      } catch {
        // Keep default stats
      }
    };

    loadStats();
  }, [token, gh.connected]);

  // Auto-fetch PRs from the first (or most recently used) repo
  useEffect(() => {
    if (!gh.connected || gh.loading || gh.repositories.length === 0) return;

    const repoName = gh.selectedRepoName || gh.repositories[0]?.full_name;
    if (!repoName) return;

    // The ref — not `pulls.length` — is the "already asked" marker. A repo with
    // no open PRs resolves to `pulls: []`, so gating on the array length made
    // every completed (or failed) response re-arm this effect and fire the
    // endpoint again forever.
    if (fetchedPRsForRepo.current === repoName) return;

    const [owner, repo] = repoName.split('/');
    if (owner && repo) {
      fetchedPRsForRepo.current = repoName;
      gh.fetchPulls(owner, repo);
    }
  }, [gh.connected, gh.loading, gh.repositories, gh.selectedRepoName, gh.fetchPulls]);

  const isNewUser = !gh.connected && !dashboardData?.activity?.length;
  const isLoading =
    dashboardLoading || (gh.connected && gh.loading && gh.repositories.length === 0);

  if (isLoading) {
    return <DashboardFullSkeleton />;
  }

  if (isNewUser) {
    return (
      <div className="space-y-6 p-6">
        <HeroSection
          user={user}
          gh={gh}
          aiRequestsToday={stats.aiRequestsToday}
          lastActivityAt={lastActivityAt ?? stats.lastActivityAt}
        />
        <QuickActions />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <HeroSection
        user={user}
        gh={gh}
        aiRequestsToday={stats.aiRequestsToday}
        lastActivityAt={lastActivityAt ?? stats.lastActivityAt}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthSnapshotCard
          repoFullName={activeRepoFullName}
          health={overview?.health ?? null}
          isLoading={healthLoading}
          error={healthErrorMessage}
          onRetry={() => {
            void refetchHealth();
          }}
        />
        <NeedsAttentionCard
          details={overview?.health?.details ?? null}
          isLoading={healthLoading}
          error={null}
          onRetry={() => {
            void refetchHealth();
          }}
          hasRepo={!!activeRepoFullName}
        />
      </div>

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <GitHubWidget gh={gh} lastSyncedAt={stats.lastSyncedAt} />
          <UsageAnalytics
            aiRequestsToday={stats.aiRequestsToday}
            codeReviews={stats.codeReviews}
            avgReviewTime={stats.avgReviewTime}
            githubRepos={gh.repositories.length}
            openPRs={gh.error && gh.pulls.length === 0 ? null : gh.pulls.length}
            connectedSince={dashboardData?.github?.connectedAt ?? null}
          />
        </div>
        <div className="space-y-6">
          <RecentActivity activities={dashboardData?.activity ?? []} />
          <UsageLimits />
          <WorkspaceStatus pendingPRReviews={gh.pulls.length} githubConnected={gh.connected} />
          <TipsCard />
        </div>
      </div>
    </div>
  );
}
