import type { IntelligenceApiResult } from './types';

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
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error?.message || body.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res;
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export const repoIntelligenceApi = {
  async analyze(
    owner: string,
    repo: string,
    token?: string,
    branch?: string,
  ): Promise<IntelligenceApiResult> {
    try {
      const params = new URLSearchParams({ owner, repo });
      if (branch) params.set('branch', branch);
      const res = await authFetch(`${API_BASE}/repo-intelligence/analyze?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: { message: (json.error as { message: string })?.message || 'Failed' },
        };
      return { success: true, data: json.data as IntelligenceApiResult['data'] };
    } catch (e) {
      return { success: false, error: { message: (e as Error).message } };
    }
  },

  async invalidate(
    owner: string,
    repo: string,
    token?: string,
    branch?: string,
  ): Promise<IntelligenceApiResult> {
    try {
      const res = await authFetch(`${API_BASE}/repo-intelligence/invalidate`, token, {
        method: 'POST',
        body: JSON.stringify({ owner, repo, branch }),
      });
      const json = await safeJson(res);
      return { success: json.success as boolean };
    } catch (e) {
      return { success: false, error: { message: (e as Error).message } };
    }
  },
};
