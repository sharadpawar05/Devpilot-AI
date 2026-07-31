import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from '@/auth';
import { MarketingLayout } from '@/layouts/marketing-layout';
import { AppLayout } from '@/layouts/app-layout';
import { LandingPage } from '@/pages/landing';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { PlaygroundPage } from '@/pages/playground';
import { NotFoundPage } from '@/pages/not-found';

const routes: RouteObject[] = [
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
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
        <AppLayout />
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
  { path: '*', element: <NotFoundPage /> },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
