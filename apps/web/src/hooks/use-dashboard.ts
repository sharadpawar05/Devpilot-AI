import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface DashboardGitHub {
  connected: boolean;
  username: string | null;
  avatar: string | null;
  connectedAt: string | null;
}

export interface DashboardActivity {
  id: string;
  action: string;
  resourceType: string;
  metadata: Record<string, unknown> | null;
}

export interface DashboardData {
  success: boolean;
  github: DashboardGitHub;
  activity: DashboardActivity[];
}

async function fetchDashboard(token: string): Promise<DashboardData> {
  const res = await fetch(`${API_BASE_URL}/dashboard`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export function useDashboard(token: string | undefined) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetchDashboard(token!),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
