import type { RepoOverviewData, RepoFileNode, RepoContributor } from './types';
import type { GenerationResult, GenerationError } from './generators';
import type { HealthActionType } from './types';

const API_BASE = '/api/v1';

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
  return fetch(url, { ...options, headers, credentials: 'include' });
}

export const repoOverviewApi = {
  async getOverview(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepoOverviewData; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    const res = await authFetch(`${API_BASE}/repo-overview/overview?${params}`, token);
    const json = await res.json();
    if (!json.success)
      return { success: false, error: json.error?.message || 'Failed to fetch overview' };
    return { success: true, data: json.data };
  },

  async getTree(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; tree?: RepoFileNode[]; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    const res = await authFetch(`${API_BASE}/repo-overview/tree?${params}`, token);
    const json = await res.json();
    if (!json.success)
      return { success: false, error: json.error?.message || 'Failed to fetch tree' };
    return { success: true, tree: json.tree };
  },

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    token?: string,
  ): Promise<{ success: boolean; content?: string; name?: string; error?: string }> {
    const params = new URLSearchParams({ owner, repo, path });
    const res = await authFetch(`${API_BASE}/repo-overview/file-content?${params}`, token);
    const json = await res.json();
    if (!json.success)
      return { success: false, error: json.error?.message || 'Failed to fetch file' };
    return { success: true, content: json.content, name: json.name };
  },

  async generateSummary(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; summary?: string; error?: string }> {
    const res = await authFetch(`${API_BASE}/repo-overview/summary`, token, {
      method: 'POST',
      body: JSON.stringify({ owner, repo }),
    });
    const json = await res.json();
    if (!json.success)
      return { success: false, error: json.error?.message || 'Failed to generate summary' };
    return { success: true, summary: json.summary };
  },

  async getContributors(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; contributors?: RepoContributor[]; error?: string }> {
    const params = new URLSearchParams({ owner, repo });
    const res = await authFetch(`${API_BASE}/repo-overview/contributors?${params}`, token);
    const json = await res.json();
    if (!json.success)
      return { success: false, error: json.error?.message || 'Failed to fetch contributors' };
    return { success: true, contributors: json.contributors };
  },

  async generate(
    owner: string,
    repo: string,
    actionType: HealthActionType,
    token?: string,
  ): Promise<{ success: boolean; data?: GenerationResult; error?: GenerationError }> {
    const res = await authFetch(`${API_BASE}/repo-overview/generate`, token, {
      method: 'POST',
      body: JSON.stringify({ owner, repo, actionType }),
    });
    const json = await res.json();
    if (!json.success)
      return {
        success: false,
        error: json.error || { code: 'UNKNOWN', message: 'Generation failed' },
      };
    return { success: true, data: json.data };
  },
};
