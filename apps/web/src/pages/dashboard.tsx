import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useGitHub, type GitHubPull } from '@/hooks/use-github';
import { useDashboard } from '@/hooks/use-dashboard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { GitHubStatusCard } from '@/components/dashboard/GitHubStatusCard';
import { RecentPullRequests } from '@/components/dashboard/RecentPullRequests';
import { UsageStatistics } from '@/components/dashboard/UsageStatistics';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import {
  DashboardHistoryWidget,
  DashboardHistorySkeleton,
} from '@/components/dashboard/DashboardHistoryWidget';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  WelcomeCardSkeleton,
  QuickActionsSkeleton,
  GitHubStatusCardSkeleton,
  UsageStatisticsSkeleton,
  RecentPullRequestsSkeleton,
  ActivityTimelineSkeleton,
} from '@/components/dashboard/skeletons';
import { aiHistoryApi } from '@/lib/ai-history';

export function DashboardPage() {
  const { user, session } = useAuth();
  const token = session?.accessToken;
  const gh = useGitHub();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(token);
  const navigate = useNavigate();
  const fetchedPRsForRepo = useRef<string | null>(null);
  const [stats, setStats] = useState({
    aiRequestsToday: 0,
    totalReviews: 0,
    avgReviewTime: '< 30s',
    tokensUsed: 0,
    githubRepos: 0,
    connectedSince: null as string | null,
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
        });
      } catch {
        // Keep default stats
      }
    };

    loadStats();
  }, [token, gh.repositories.length, dashboardData?.github?.connectedAt]);

  // Auto-fetch PRs from the first (or most recently used) repo
  useEffect(() => {
    if (!gh.connected || gh.loading || gh.repositories.length === 0) return;

    const repoName = gh.selectedRepoName || gh.repositories[0]?.full_name;
    if (!repoName) return;

    // Don't refetch if we already fetched for this repo
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

  const handleOpenPR = useCallback(
    (_pr: GitHubPull) => {
      if (gh.connected) {
        navigate('/pull-request-assistant');
      } else {
        navigate('/github');
      }
    },
    [gh.connected, navigate],
  );

  const isNewUser = !gh.connected && !dashboardData?.activity?.length;
  const isLoading =
    dashboardLoading || (gh.connected && gh.loading && gh.repositories.length === 0);

  return (
    <div className="space-y-6 p-6">
      {isLoading ? <WelcomeCardSkeleton /> : <WelcomeCard user={user} />}

      {isLoading ? <QuickActionsSkeleton /> : <QuickActions />}

      {!isLoading && isNewUser && <EmptyState />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? <GitHubStatusCardSkeleton /> : <GitHubStatusCard gh={gh} />}
        </div>
        {isLoading ? <UsageStatisticsSkeleton /> : <UsageStatistics stats={stats} />}
      </div>

      {gh.connected && gh.pulls.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {isLoading ? (
            <RecentPullRequestsSkeleton />
          ) : (
            <RecentPullRequests pulls={gh.pulls} onOpenPR={handleOpenPR} />
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <ActivityTimelineSkeleton />
        ) : (
          <ActivityTimeline activities={dashboardData?.activity ?? []} />
        )}
        {isLoading ? <DashboardHistorySkeleton /> : <DashboardHistoryWidget />}
      </div>
    </div>
  );
}
