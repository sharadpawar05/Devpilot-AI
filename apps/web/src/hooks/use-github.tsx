import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '@/auth';
import { saveReturnUrl } from '@/lib/oauth-redirect';
import { aiHistoryApi } from '@/lib/ai-history';
import { generateId } from '@/lib/id';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

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
  disconnecting: boolean;
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
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disconnectedRef = useRef(false);

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

  const apiFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      return fetch(url, {
        credentials: 'include',
        ...init,
        headers: { ...authHeaders(), ...init?.headers },
      });
    },
    [authHeaders],
  );

  const fetchRepositories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/github/repositories`);
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
  }, [token, apiFetch]);

  const checkConnection = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/github/status`);
      const data = await res.json();
      if (data.success && data.connected) {
        if (!disconnectedRef.current) {
          setConnected(true);
          setGithubUser(data.user);
          setConnectedAt(data.connectedAt);
          fetchRepositories();
        }
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
        saveReturnUrl(returnTo);
        const res = await apiFetch(`${API_BASE_URL}/github/auth-url`);
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
    [token, apiFetch],
  );

  const handleCallback = useCallback(
    async (code: string, state: string): Promise<boolean> => {
      if (!token) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `${API_BASE_URL}/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
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
    disconnectedRef.current = true;
    setDisconnecting(true);
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
    try {
      await apiFetch(`${API_BASE_URL}/github/disconnect`, {
        method: 'DELETE',
      });
    } catch {
      /* noop */
    } finally {
      setDisconnecting(false);
      disconnectedRef.current = false;
    }
  }, [token, apiFetch]);

  const fetchBranches = useCallback(
    async (owner: string, repo: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`${API_BASE_URL}/github/repositories/${owner}/${repo}/branches`);
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
    [token, apiFetch],
  );

  const fetchPulls = useCallback(
    async (owner: string, repo: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`${API_BASE_URL}/github/repositories/${owner}/${repo}/pulls`);
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
    [token, apiFetch],
  );

  const fetchFiles = useCallback(
    async (owner: string, repo: string, pullNumber: number) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `${API_BASE_URL}/github/pulls/${owner}/${repo}/${pullNumber}/files`,
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
    [token, apiFetch],
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
        const res = await apiFetch(`${API_BASE_URL}/github/review`, {
          method: 'POST',
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (data.success) {
          const response = data as GitHubReviewResponse;
          if (token) {
            await aiHistoryApi.createSession(token, {
              workflowType: 'pr-review',
              repository: `${params.owner}/${params.repo}`,
              title: `PR #${params.pull_number} Review`,
              provider: response.provider as never,
              model: response.model as never,
              messages: [
                {
                  id: generateId(),
                  role: 'user',
                  content: `Review PR #${params.pull_number} in ${params.owner}/${params.repo}`,
                  latency: 0,
                  tokens: 0,
                  timestamp: new Date().toISOString(),
                },
                {
                  id: generateId(),
                  role: 'assistant',
                  content: response.response,
                  latency: response.latencyMs,
                  tokens: response.usage.total,
                  timestamp: new Date().toISOString(),
                },
              ],
            });
          }
          setLoading(false);
          return response;
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
    [token, apiFetch],
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
        const res = await apiFetch(`${API_BASE_URL}/github/analyze`, {
          method: 'POST',
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (data.success) {
          const response = data as GitHubAnalyzeResponse;
          if (token) {
            await aiHistoryApi.createSession(token, {
              workflowType: 'pr-review',
              repository: `${params.owner}/${params.repo}`,
              title: `PR #${params.pull_number} Analysis`,
              provider: response.provider as never,
              model: response.model as never,
              messages: [
                {
                  id: generateId(),
                  role: 'user',
                  content: `Analyze PR #${params.pull_number} in ${params.owner}/${params.repo}`,
                  latency: 0,
                  tokens: 0,
                  timestamp: new Date().toISOString(),
                },
                {
                  id: generateId(),
                  role: 'assistant',
                  content: response.response,
                  latency: response.latencyMs,
                  tokens: response.usage.total,
                  timestamp: new Date().toISOString(),
                },
              ],
            });
          }
          setLoading(false);
          return response;
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
    [token, apiFetch],
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
    disconnecting,
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
