import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useDashboard } from '@/hooks/use-dashboard';
import { HeroSection } from '@/components/dashboard/HeroSection';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { GitHubWidget } from '@/components/dashboard/GitHubWidget';
import { UsageAnalytics } from '@/components/dashboard/UsageAnalytics';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { WorkspaceStatus } from '@/components/dashboard/WorkspaceStatus';
import { TipsCard } from '@/components/dashboard/TipsCard';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { DashboardFullSkeleton } from '@/components/dashboard/skeletons';
import { aiHistoryApi } from '@/lib/ai-history';

export function DashboardPage() {
  const { user, session } = useAuth();
  const token = session?.accessToken;
  const gh = useGitHub();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(token);
  const fetchedPRsForRepo = useRef<string | null>(null);
  const [stats, setStats] = useState({
    aiRequestsToday: 0,
    totalReviews: 0,
    avgReviewTime: '< 30s',
    tokensUsed: 0,
    githubRepos: 0,
    connectedSince: null as string | null,
    lastSyncedAt: null as string | null,
    lastAIModel: null as string | null,
    lastActivityAt: null as string | null,
  });

  useEffect(() => {
    if (!token) return;

    const loadStats = async () => {
      try {
        const result = await aiHistoryApi.listSessions(token, {}, { page: 1, pageSize: 100 });
        const sessions = result.sessions;
        const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
        const totalLatency = sessions.reduce((sum, s) => sum + s.totalLatency, 0);
        const reviewSessions = sessions.filter(
          (s) => s.workflowType === 'code-review' || s.workflowType === 'pr-review',
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter((s) => new Date(s.createdAt) >= today);

        const mostRecent = sessions.length > 0 ? sessions[0] : null;

        setStats({
          aiRequestsToday: todaySessions.length,
          totalReviews: reviewSessions.length,
          avgReviewTime:
            reviewSessions.length > 0
              ? `${Math.round(totalLatency / reviewSessions.length / 1000)}s`
              : '< 30s',
          tokensUsed: totalTokens,
          githubRepos: gh.repositories.length,
          connectedSince: dashboardData?.github?.connectedAt ?? null,
          lastSyncedAt: gh.connected ? new Date().toISOString() : null,
          lastAIModel: mostRecent?.model ?? null,
          lastActivityAt: mostRecent?.createdAt ?? null,
        });
      } catch {
        // Keep default stats
      }
    };

    loadStats();
  }, [token, gh.repositories.length, gh.connected, dashboardData?.github?.connectedAt]);

  // Auto-fetch PRs from the first (or most recently used) repo
  useEffect(() => {
    if (!gh.connected || gh.loading || gh.repositories.length === 0) return;

    const repoName = gh.selectedRepoName || gh.repositories[0]?.full_name;
    if (!repoName) return;

    if (fetchedPRsForRepo.current === repoName && gh.pulls.length > 0) return;

    const [owner, repo] = repoName.split('/');
    if (owner && repo) {
      fetchedPRsForRepo.current = repoName;
      gh.fetchPulls(owner, repo);
    }
  }, [
    gh.connected,
    gh.loading,
    gh.repositories,
    gh.selectedRepoName,
    gh.fetchPulls,
    gh.pulls.length,
  ]);

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
          lastActivityAt={stats.lastActivityAt}
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
        lastActivityAt={stats.lastActivityAt}
      />

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <GitHubWidget gh={gh} lastSyncedAt={stats.lastSyncedAt} />
          <UsageAnalytics
            aiRequestsToday={stats.aiRequestsToday}
            totalReviews={stats.totalReviews}
            avgReviewTime={stats.avgReviewTime}
            tokensUsed={stats.tokensUsed}
            githubRepos={stats.githubRepos}
            openPRs={gh.pulls.length}
            connectedSince={stats.connectedSince}
          />
        </div>
        <div className="space-y-6">
          <RecentActivity activities={dashboardData?.activity ?? []} />
          <WorkspaceStatus
            repoHealthScore={null}
            pendingPRReviews={gh.pulls.length}
            githubConnected={gh.connected}
            lastAIModel={stats.lastAIModel}
          />
          <TipsCard />
        </div>
      </div>
    </div>
  );
}
