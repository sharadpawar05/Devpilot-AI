import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useGitHub, type GitHubPull } from '@/hooks/use-github';
import { useDashboard } from '@/hooks/use-dashboard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { GitHubStatusCard } from '@/components/dashboard/GitHubStatusCard';
import { RecentPullRequests } from '@/components/dashboard/RecentPullRequests';
import { RecentReviews } from '@/components/dashboard/RecentReviews';
import { UsageStatistics } from '@/components/dashboard/UsageStatistics';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { RecentProjects } from '@/components/dashboard/RecentProjects';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  WelcomeCardSkeleton,
  QuickActionsSkeleton,
  GitHubStatusCardSkeleton,
  UsageStatisticsSkeleton,
  RecentPullRequestsSkeleton,
  RecentReviewsSkeleton,
  ActivityTimelineSkeleton,
} from '@/components/dashboard/skeletons';

export function DashboardPage() {
  const { user, session } = useAuth();
  const gh = useGitHub();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard(session?.accessToken);
  const navigate = useNavigate();
  const fetchedPRsForRepo = useRef<string | null>(null);

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

  const stats = {
    aiRequestsToday: 0,
    totalReviews: 0,
    avgReviewTime: '< 30s',
    tokensUsed: 0,
    githubRepos: gh.repositories.length,
    connectedSince: dashboardData?.github?.connectedAt ?? null,
  };

  return (
    <div className="space-y-6 p-6">
      {isLoading ? <WelcomeCardSkeleton /> : <WelcomeCard user={user} />}

      {isLoading ? <QuickActionsSkeleton /> : <QuickActions />}

      {isNewUser && <EmptyState />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? <GitHubStatusCardSkeleton /> : <GitHubStatusCard gh={gh} />}
        </div>
        {isLoading ? <UsageStatisticsSkeleton /> : <UsageStatistics stats={stats} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <RecentPullRequestsSkeleton />
        ) : (
          <RecentPullRequests pulls={gh.pulls} onOpenPR={handleOpenPR} />
        )}
        {isLoading ? <RecentReviewsSkeleton /> : <RecentReviews reviews={[]} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <ActivityTimelineSkeleton />
        ) : (
          <ActivityTimeline activities={dashboardData?.activity ?? []} />
        )}
        <RecentProjects projects={[]} />
      </div>
    </div>
  );
}
