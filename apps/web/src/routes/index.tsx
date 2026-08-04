import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from '@/auth';
import { MarketingLayout } from '@/layouts/marketing-layout';
import { AppLayout } from '@/layouts/app-layout';
import { GitHubProvider } from '@/hooks/use-github';
import { LandingPage } from '@/pages/landing';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { PlaygroundPage } from '@/pages/playground';
import { CodeReviewPage } from '@/pages/code-review';
import { GitHubReviewPage } from '@/pages/github';
import { PullRequestAssistantPage } from '@/pages/pull-request-assistant';
import { RepositoryChatPage } from '@/pages/repository-chat';
import RepositoryOverviewPage from '@/pages/repository-overview';
import SprintSummaryPage from '@/pages/sprint-summary';
import ReleaseNotesPage from '@/pages/release-notes';
import EngineeringStatusPage from '@/pages/engineering-status';
import IncidentSummaryPage from '@/pages/incident-summary';
import { HistoryPage } from '@/pages/history';
import AnalyticsPage from '@/pages/analytics';
import SettingsPage from '@/pages/settings';
import { NotFoundPage } from '@/pages/not-found';
import { useAuth } from '@/auth';

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

const routes: RouteObject[] = [
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        path: '/login',
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <GitHubProvider>
          <AppLayout />
        </GitHubProvider>
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/playground', element: <PlaygroundPage /> },
      { path: '/code-review', element: <CodeReviewPage /> },
      { path: '/github', element: <GitHubReviewPage /> },
      { path: '/pull-request-assistant', element: <PullRequestAssistantPage /> },
      { path: '/repository-overview', element: <RepositoryOverviewPage /> },
      { path: '/sprint-summary', element: <SprintSummaryPage /> },
      { path: '/release-notes', element: <ReleaseNotesPage /> },
      { path: '/engineering-status', element: <EngineeringStatusPage /> },
      { path: '/incident-summary', element: <IncidentSummaryPage /> },
      { path: '/repository-chat', element: <RepositoryChatPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
