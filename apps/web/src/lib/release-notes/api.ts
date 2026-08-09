import type { ReleaseNotesRequest, ReleaseNotesResponse, ReleaseTag } from './types';

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
