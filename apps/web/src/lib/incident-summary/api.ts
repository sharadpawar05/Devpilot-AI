import type { IncidentSummaryRequest, IncidentSummaryResponse } from './types';
import { ApiError } from '@/lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class IncidentSummaryApiError extends ApiError {}

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
    const err = errorBody?.error ?? {};
    throw new IncidentSummaryApiError(err.message || `Request failed with status ${res.status}`, {
      code: err.code,
      retryable: err.retryable,
      feature: err.feature,
      used: err.used,
      limit: err.limit,
      resetAt: err.resetAt,
    });
  }

  return res;
}

export const incidentSummaryApi = {
  async generateSummary(
    request: IncidentSummaryRequest,
    token?: string,
  ): Promise<IncidentSummaryResponse> {
    const res = await authFetch(`${API_BASE}/incident-summary/generate`, token, {
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
