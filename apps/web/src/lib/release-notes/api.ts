import type { ReleaseNotesRequest, ReleaseNotesResponse, ReleaseTag } from './types';
import { ApiError } from '@/lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class ReleaseNotesApiError extends ApiError {}

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
    throw new ReleaseNotesApiError(err.message || `Request failed with status ${res.status}`, {
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

export const releaseNotesApi = {
  async generateReleaseNotes(
    request: ReleaseNotesRequest,
    token?: string,
  ): Promise<ReleaseNotesResponse> {
    const res = await authFetch(`${API_BASE}/release-notes/generate`, token, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return res.json();
  },

  async getReleaseTags(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; tags: ReleaseTag[] }> {
    const res = await authFetch(
      `${API_BASE}/release-notes/tags?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      token,
    );
    return res.json();
  },
};
