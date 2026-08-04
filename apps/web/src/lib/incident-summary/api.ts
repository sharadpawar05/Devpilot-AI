import type { IncidentSummaryRequest, IncidentSummaryResponse } from './types';

const API_BASE = '/api/v1';

async function authFetch(
  url: string,
  token?: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Request failed with status ${res.status}`);
  }
  return res;
}

export const incidentSummaryApi = {
  async generateReport(
    request: IncidentSummaryRequest,
    token?: string,
  ): Promise<IncidentSummaryResponse> {
    const res = await authFetch(`${API_BASE}/incident-summary/generate`, token, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return res.json();
  },
};
