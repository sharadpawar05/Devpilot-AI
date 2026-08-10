import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface UsageData {
  plan: string;
  period: string;
  repositories: { used: number; limit: number };
  healthScans: { used: number; limit: number };
  aiReports: { used: number; limit: number };
  aiChat: { used: number; limit: number };
}

async function fetchUsage(token: string): Promise<UsageData> {
  const res = await fetch(`${API_BASE_URL}/usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Failed to fetch usage');
  return data.data;
}

export function useUsage() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery({
    queryKey: ['usage'],
    queryFn: () => fetchUsage(token!),
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
