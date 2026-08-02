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
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <GitHubProvider>
          <AppLayout />
        </GitHubProvider>
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <DashboardPage /> }],
  },
  {
    path: '/playground',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <PlaygroundPage /> }],
  },
  {
    path: '/code-review',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <CodeReviewPage /> }],
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
      { path: '/github', element: <GitHubReviewPage /> },
      { path: '/pull-request-assistant', element: <PullRequestAssistantPage /> },
      { path: '/repository-chat', element: <RepositoryChatPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
