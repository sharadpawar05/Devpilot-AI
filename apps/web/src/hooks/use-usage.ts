import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface UsageData {
  plan: string;
  periodStart: string;
  periodEnd: string;
  /** When counters reset (ISO). Alias for periodEnd when present. */
  resetAt?: string;
  usage: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
  limits: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
  remaining: {
    aiCredits: number;
    healthScans: number;
    aiReports: number;
    chatMessages: number;
    repositories: number;
  };
}

async function fetchUsage(token: string): Promise<UsageData> {
  const res = await fetch(`${API_BASE_URL}/usage`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  let body: {
    success?: boolean;
    data?: UsageData;
    error?: { message?: string };
  };
  try {
    body = await res.json();
  } catch {
    throw new Error(`Usage request failed (${res.status})`);
  }

  if (!res.ok || !body.success || !body.data) {
    throw new Error(body.error?.message || `Usage request failed (${res.status})`);
  }
  return body.data;
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
