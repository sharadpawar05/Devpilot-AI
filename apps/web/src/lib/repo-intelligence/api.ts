import type {
  RepositoryOverview,
  RepositoryMetadata,
  RepositoryStatistics,
  RepositoryHealth,
  Contributor,
  PullRequest,
  PullRequestFile,
  Commit,
  Release,
  Issue,
  ActivityEvent,
  CommitActivity,
  FileTreeNode,
  FileContent,
  IntelligenceApiResult,
} from './types';

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

function buildParams(owner: string, repo: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ owner, repo });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) params.set(key, value);
    }
  }
  return params.toString();
}

export const repositoryIntelligenceApi = {
  // ─── Overview ──────────────────────────────────────────────────────────

  async getOverview(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepositoryOverview; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/overview?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch overview',
        };
      return { success: true, data: json.data as RepositoryOverview };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Metadata ──────────────────────────────────────────────────────────

  async getMetadata(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepositoryMetadata; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/metadata?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch metadata',
        };
      return { success: true, data: json.data as RepositoryMetadata };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Statistics ────────────────────────────────────────────────────────

  async getStatistics(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepositoryStatistics; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/statistics?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch statistics',
        };
      return { success: true, data: json.data as RepositoryStatistics };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Contributors ──────────────────────────────────────────────────────

  async getContributors(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: Contributor[]; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/contributors?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch contributors',
        };
      return { success: true, data: json.data as Contributor[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Pull Requests ─────────────────────────────────────────────────────

  async getPullRequests(
    owner: string,
    repo: string,
    token?: string,
    state: string = 'open',
  ): Promise<{ success: boolean; data?: PullRequest[]; error?: string }> {
    try {
      const params = buildParams(owner, repo, { state });
      const res = await authFetch(`${API_BASE}/repo-intelligence/pull-requests?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch pull requests',
        };
      return { success: true, data: json.data as PullRequest[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Pull Request Files ────────────────────────────────────────────────

  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    token?: string,
  ): Promise<{ success: boolean; data?: PullRequestFile[]; error?: string }> {
    try {
      const res = await authFetch(
        `${API_BASE}/repo-intelligence/pull-requests/${pullNumber}/files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        token,
      );
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch PR files',
        };
      return { success: true, data: json.data as PullRequestFile[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Commits ───────────────────────────────────────────────────────────

  async getCommits(
    owner: string,
    repo: string,
    token?: string,
    branch?: string,
  ): Promise<{ success: boolean; data?: Commit[]; error?: string }> {
    try {
      const params = buildParams(owner, repo, branch ? { branch } : undefined);
      const res = await authFetch(`${API_BASE}/repo-intelligence/commits?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch commits',
        };
      return { success: true, data: json.data as Commit[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Releases ──────────────────────────────────────────────────────────

  async getReleases(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: Release[]; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/releases?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch releases',
        };
      return { success: true, data: json.data as Release[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Issues ────────────────────────────────────────────────────────────

  async getIssues(
    owner: string,
    repo: string,
    token?: string,
    state: string = 'open',
  ): Promise<{ success: boolean; data?: Issue[]; error?: string }> {
    try {
      const params = buildParams(owner, repo, { state });
      const res = await authFetch(`${API_BASE}/repo-intelligence/issues?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch issues',
        };
      return { success: true, data: json.data as Issue[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Activity ──────────────────────────────────────────────────────────

  async getActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: ActivityEvent[]; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/activity?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch activity',
        };
      return { success: true, data: json.data as ActivityEvent[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Commit Activity ───────────────────────────────────────────────────

  async getCommitActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: CommitActivity[]; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/commit-activity?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch commit activity',
        };
      return { success: true, data: json.data as CommitActivity[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── File Tree ─────────────────────────────────────────────────────────

  async getFileTree(
    owner: string,
    repo: string,
    token?: string,
    branch?: string,
  ): Promise<{ success: boolean; data?: FileTreeNode[]; error?: string }> {
    try {
      const params = buildParams(owner, repo, branch ? { branch } : undefined);
      const res = await authFetch(`${API_BASE}/repo-intelligence/file-tree?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch file tree',
        };
      return { success: true, data: json.data as FileTreeNode[] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── File Content ──────────────────────────────────────────────────────

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    token?: string,
    branch?: string,
  ): Promise<{ success: boolean; data?: FileContent; error?: string }> {
    try {
      const params = buildParams(owner, repo, { path, ...(branch ? { branch } : {}) });
      const res = await authFetch(`${API_BASE}/repo-intelligence/file-content?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch file content',
        };
      return { success: true, data: json.data as FileContent };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Health ────────────────────────────────────────────────────────────

  async getHealth(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; data?: RepositoryHealth; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/health?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch health',
        };
      return { success: true, data: json.data as RepositoryHealth };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Technology Analysis ───────────────────────────────────────────────

  async analyze(
    owner: string,
    repo: string,
    token?: string,
    branch?: string,
  ): Promise<IntelligenceApiResult> {
    try {
      const params = buildParams(owner, repo, branch ? { branch } : undefined);
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

  // ─── Readme ────────────────────────────────────────────────────────────

  async getReadme(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const params = buildParams(owner, repo);
      const res = await authFetch(`${API_BASE}/repo-intelligence/readme?${params}`, token);
      const json = await safeJson(res);
      if (!json.success)
        return {
          success: false,
          error: (json.error as { message?: string })?.message || 'Failed to fetch readme',
        };
      return { success: true, content: (json.data as { content: string })?.content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  },

  // ─── Invalidate Cache ──────────────────────────────────────────────────

  async invalidate(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await authFetch(`${API_BASE}/repo-intelligence/invalidate`, token, {
        method: 'POST',
        body: JSON.stringify({ owner, repo }),
      });
      const json = await safeJson(res);
      return { success: json.success as boolean };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
