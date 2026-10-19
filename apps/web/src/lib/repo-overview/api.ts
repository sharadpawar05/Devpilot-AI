import type { RepoOverviewData, RepoFileNode, RepoContributor } from './types';
import type { GenerationResult, GenerationError } from './generators';
import type { HealthActionType } from './types';
import type { TechnologyStack } from './analyzer';
import { ApiError } from '@/lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authFetch(
  url: string,
  token?: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    let errCode: string | undefined;
    let feature: string | undefined;
    let used: number | undefined;
    let limit: number | undefined;
    let resetAt: string | undefined;
    try {
      const json = JSON.parse(text);
      const body = json.error ?? {};
      message = body.message || json.message || message;
      errCode = typeof body.code === 'string' ? body.code : undefined;
      feature = typeof body.feature === 'string' ? body.feature : undefined;
      used = typeof body.used === 'number' ? body.used : undefined;
      limit = typeof body.limit === 'number' ? body.limit : undefined;
      resetAt = typeof body.resetAt === 'string' ? body.resetAt : undefined;
    } catch {
      message = text || message;
    }
    throw new ApiError(message, { code: errCode, feature, used, limit, resetAt, retryable: false });
  }
  return res;
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from server');
  }
}

export const repoOverviewApi = {
  async getOverview(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepoOverviewData; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/overview?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch overview',
        };
      return { success: true, data: json.data as RepoOverviewData };
    } catch (error) {
      // Keep the structured envelope (code, feature, used/limit, resetAt) so
      // callers can show the real reason (e.g. a usage limit) instead of a
      // generic "Something went wrong" message.
      if (error instanceof ApiError) throw error;
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  async getTree(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; tree?: RepoFileNode[]; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/tree?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch tree',
        };
      return { success: true, tree: json.tree as RepoFileNode[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    token?: string,
  ): Promise<{ success: boolean; content?: string; name?: string; error?: string }> {
    const params = new URLSearchParams({ owner, repo, path });
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/file-content?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch file',
        };
      return { success: true, content: json.content as string, name: json.name as string };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  async generateSummary(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/summary`, token, {
        method: 'POST',
        body: JSON.stringify({ owner, repo }),
      });
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to generate summary',
        };
      return { success: true, summary: json.summary as string };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  async getContributors(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; contributors?: RepoContributor[]; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/contributors?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch contributors',
        };
      return { success: true, contributors: json.contributors as RepoContributor[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  async generate(
    owner: string,
    repo: string,
    actionType: HealthActionType,
    token?: string,
  ): Promise<{ success: boolean; data?: GenerationResult; error?: GenerationError }> {
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/generate`, token, {
        method: 'POST',
        body: JSON.stringify({ owner, repo, actionType }),
      });
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as GenerationError) || {
            code: 'UNKNOWN',
            message: 'Generation failed',
          },
        };
      return { success: true, data: json.data as GenerationResult };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  },

  async analyze(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; stack?: TechnologyStack; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    try {
      const res = await authFetch(`${API_BASE}/repo-overview/analyze?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to analyze repository',
        };
      return { success: true, stack: json.stack as TechnologyStack };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },
};
