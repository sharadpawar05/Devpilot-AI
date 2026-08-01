import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  language: string | null;
  updated_at: string;
  html_url: string;
}

interface GitHubBranch {
  name: string;
  is_default: boolean;
}

interface GitHubPull {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GitHubReviewResponse {
  success: boolean;
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  reviewDepth: string;
  pr: {
    number: number;
    title: string;
    url: string;
    author: string | null;
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  usage: {
    input: number;
    output: number;
    total: number;
  };
}

interface GitHubReviewError {
  success: false;
  error: { code: string; message: string };
}

export type { GitHubReviewError };

export function useGitHub() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [connected, setConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [pulls, setPulls] = useState<GitHubPull[]>([]);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const fetchRepositories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/github/repositories`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setRepositories(data.repositories);
      } else {
        setError(data.error?.message ?? 'Failed to fetch repositories');
      }
    } catch {
      setError('Failed to fetch repositories');
    }
    setLoading(false);
  }, [token, authHeaders]);

  const checkConnection = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/github/account`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.connected) {
        setConnected(true);
        setGithubUser(data.user);
        fetchRepositories();
      } else {
        setConnected(false);
        setGithubUser(null);
      }
    } catch {
      setConnected(false);
    }
  }, [token, authHeaders, fetchRepositories]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(async (): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/github/auth-url`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
      setError(data.error?.message ?? 'Failed to get GitHub auth URL');
      return null;
    } catch {
      setError('Failed to connect to server');
      return null;
    }
  }, [token, authHeaders]);

  const handleCallback = useCallback(
    async (code: string): Promise<boolean> => {
      if (!token) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/github/callback?code=${code}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setConnected(true);
          setGithubUser(data.user);
          setLoading(false);
          fetchRepositories();
          return true;
        }
        setError(data.error?.message ?? 'Failed to authenticate with GitHub');
        setLoading(false);
        return false;
      } catch {
        setError('Failed to connect to server');
        setLoading(false);
        return false;
      }
    },
    [token, authHeaders, fetchRepositories],
  );

  const disconnect = useCallback(async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/github/disconnect`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setConnected(false);
      setGithubUser(null);
      setRepositories([]);
      setBranches([]);
      setPulls([]);
      setFiles([]);
    } catch {
      /* noop */
    }
  }, [token, authHeaders]);

  const fetchBranches = useCallback(
    async (owner: string, repo: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/github/repositories/${owner}/${repo}/branches`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setBranches(data.branches);
        } else {
          setError(data.error?.message ?? 'Failed to fetch branches');
        }
      } catch {
        setError('Failed to fetch branches');
      }
      setLoading(false);
    },
    [token, authHeaders],
  );

  const fetchPulls = useCallback(
    async (owner: string, repo: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/github/repositories/${owner}/${repo}/pulls`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setPulls(data.pulls);
        } else {
          setError(data.error?.message ?? 'Failed to fetch pull requests');
        }
      } catch {
        setError('Failed to fetch pull requests');
      }
      setLoading(false);
    },
    [token, authHeaders],
  );

  const fetchFiles = useCallback(
    async (owner: string, repo: string, pullNumber: number) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/github/pulls/${owner}/${repo}/${pullNumber}/files`,
          { headers: authHeaders() },
        );
        const data = await res.json();
        if (data.success) {
          setFiles(data.files);
        } else {
          setError(data.error?.message ?? 'Failed to fetch files');
        }
      } catch {
        setError('Failed to fetch files');
      }
      setLoading(false);
    },
    [token, authHeaders],
  );

  const reviewPR = useCallback(
    async (params: {
      owner: string;
      repo: string;
      pull_number: number;
      files?: string[];
      reviewType?: string;
      reviewDepth?: string;
      provider?: string;
    }): Promise<GitHubReviewResponse | null> => {
      if (!token) return null;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/github/review`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (data.success) {
          setLoading(false);
          return data as GitHubReviewResponse;
        }
        setError(data.error?.message ?? 'Review failed');
        setLoading(false);
        return null;
      } catch {
        setError('Failed to connect to server');
        setLoading(false);
        return null;
      }
    },
    [token, authHeaders],
  );

  return {
    connected,
    githubUser,
    repositories,
    branches,
    pulls,
    files,
    loading,
    error,
    connect,
    handleCallback,
    disconnect,
    fetchRepositories,
    fetchBranches,
    fetchPulls,
    fetchFiles,
    reviewPR,
    setFiles,
  };
}

export type { GitHubRepo, GitHubBranch, GitHubPull, GitHubFile, GitHubReviewResponse };
