import { useCallback } from 'react';
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

export function DashboardPage() {
  const { user, session } = useAuth();
  const gh = useGitHub();
  const { data: dashboardData } = useDashboard(session?.accessToken);
  const navigate = useNavigate();

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
      <WelcomeCard user={user} />

      <QuickActions />

      {isNewUser && <EmptyState />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GitHubStatusCard gh={gh} />
        </div>
        <UsageStatistics stats={stats} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentPullRequests pulls={gh.pulls} onOpenPR={handleOpenPR} />
        <RecentReviews reviews={[]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityTimeline activities={dashboardData?.activity ?? []} />
        <RecentProjects projects={[]} />
      </div>
    </div>
  );
}
