import type { SprintSummaryRequest, SprintSummaryResponse } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authFetch(
  url: string,
  token?: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.error?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res;
}

export const sprintSummaryApi = {
  async generateSummary(
    request: SprintSummaryRequest,
    token?: string,
  ): Promise<SprintSummaryResponse> {
    const res = await authFetch(`${API_BASE}/sprint-summary/generate`, token, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    try {
      return await res.json();
    } catch {
      throw new Error('Invalid response from server');
    }
  },
};
