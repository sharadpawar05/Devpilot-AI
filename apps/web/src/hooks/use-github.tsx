import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STORAGE_KEYS = {
  REPO: 'devpilot_github_selected_repo',
  BRANCH: 'devpilot_github_selected_branch',
  PR: 'devpilot_github_selected_pr',
} as const;

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  id?: number;
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

interface GitHubAnalyzeResponse {
  success: boolean;
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  truncated: boolean;
  fileTypes: string;
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

export interface GitHubContextValue {
  connected: boolean;
  githubUser: GitHubUser | null;
  connectedAt: string | null;
  repositories: GitHubRepo[];
  branches: GitHubBranch[];
  pulls: GitHubPull[];
  files: GitHubFile[];
  loading: boolean;
  error: string | null;
  selectedRepoName: string | null;
  selectedBranch: string | null;
  selectedPRNumber: number | null;
  connect: (returnTo?: string) => Promise<string | null>;
  handleCallback: (code: string, state: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshConnection: () => Promise<void>;
  fetchRepositories: () => Promise<void>;
  fetchBranches: (owner: string, repo: string) => Promise<void>;
  fetchPulls: (owner: string, repo: string) => Promise<void>;
  fetchFiles: (owner: string, repo: string, pullNumber: number) => Promise<void>;
  reviewPR: (params: {
    owner: string;
    repo: string;
    pull_number: number;
    files?: string[];
    reviewType?: string;
    reviewDepth?: string;
    provider?: string;
  }) => Promise<GitHubReviewResponse | null>;
  analyzePR: (params: {
    owner: string;
    repo: string;
    pull_number: number;
    provider?: string;
  }) => Promise<GitHubAnalyzeResponse | null>;
  selectRepo: (fullName: string | null) => void;
  selectBranch: (branch: string | null) => void;
  selectPR: (prNumber: number | null) => void;
  setFiles: React.Dispatch<React.SetStateAction<GitHubFile[]>>;
}

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

function loadStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function storeValue(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* noop */
  }
}

export function GitHubProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [connected, setConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [pulls, setPulls] = useState<GitHubPull[]>([]);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRepoName, setSelectedRepoName] = useState<string | null>(() =>
    loadStoredValue<string | null>(STORAGE_KEYS.REPO, null),
  );
  const [selectedBranch, setSelectedBranch] = useState<string | null>(() =>
    loadStoredValue<string | null>(STORAGE_KEYS.BRANCH, null),
  );
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(() =>
    loadStoredValue<number | null>(STORAGE_KEYS.PR, null),
  );

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
      const res = await fetch(`${API_BASE_URL}/github/status`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.connected) {
        setConnected(true);
        setGithubUser(data.user);
        setConnectedAt(data.connectedAt);
        fetchRepositories();
      } else {
        setConnected(false);
        setGithubUser(null);
        setConnectedAt(null);
      }
    } catch {
      setConnected(false);
    }
  }, [token, authHeaders, fetchRepositories]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = useCallback(
    async (returnTo?: string): Promise<string | null> => {
      if (!token) return null;
      try {
        const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
        const res = await fetch(`${API_BASE_URL}/github/auth-url${params}`, {
          headers: authHeaders(),
        });
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
    },
    [token, authHeaders],
  );

  const handleCallback = useCallback(
    async (code: string, state: string): Promise<boolean> => {
      if (!token) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
          { headers: authHeaders() },
        );
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
      setConnectedAt(null);
      setRepositories([]);
      setBranches([]);
      setPulls([]);
      setFiles([]);
      setSelectedRepoName(null);
      setSelectedBranch(null);
      setSelectedPRNumber(null);
      storeValue(STORAGE_KEYS.REPO, null);
      storeValue(STORAGE_KEYS.BRANCH, null);
      storeValue(STORAGE_KEYS.PR, null);
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

  const analyzePR = useCallback(
    async (params: {
      owner: string;
      repo: string;
      pull_number: number;
      provider?: string;
    }): Promise<GitHubAnalyzeResponse | null> => {
      if (!token) return null;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/github/analyze`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (data.success) {
          setLoading(false);
          return data as GitHubAnalyzeResponse;
        }
        setError(data.error?.message ?? 'Analysis failed');
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

  const selectRepo = useCallback((fullName: string | null) => {
    setSelectedRepoName(fullName);
    setSelectedBranch(null);
    setSelectedPRNumber(null);
    storeValue(STORAGE_KEYS.REPO, fullName);
    storeValue(STORAGE_KEYS.BRANCH, null);
    storeValue(STORAGE_KEYS.PR, null);
  }, []);

  const selectBranch = useCallback((branch: string | null) => {
    setSelectedBranch(branch);
    storeValue(STORAGE_KEYS.BRANCH, branch);
  }, []);

  const selectPR = useCallback((prNumber: number | null) => {
    setSelectedPRNumber(prNumber);
    storeValue(STORAGE_KEYS.PR, prNumber);
  }, []);

  const refreshConnection = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  const value: GitHubContextValue = {
    connected,
    githubUser,
    connectedAt,
    repositories,
    branches,
    pulls,
    files,
    loading,
    error,
    selectedRepoName,
    selectedBranch,
    selectedPRNumber,
    connect,
    handleCallback,
    disconnect,
    refreshConnection,
    fetchRepositories,
    fetchBranches,
    fetchPulls,
    fetchFiles,
    reviewPR,
    analyzePR,
    selectRepo,
    selectBranch,
    selectPR,
    setFiles,
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
}

export function useGitHub(): GitHubContextValue {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
}

export type {
  GitHubRepo,
  GitHubBranch,
  GitHubPull,
  GitHubFile,
  GitHubReviewResponse,
  GitHubAnalyzeResponse,
};
