import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/auth';
import type {
  AIHistorySession,
  AIHistorySessionMetadata,
  AIHistoryFilters,
  AIHistoryListResult,
  AIHistoryMessage,
  WorkflowType,
  AIProviderName,
  AIModel,
} from '@devpilot/types';
import { aiHistoryApi } from '@/lib/ai-history';

const DEFAULT_PAGE_SIZE = 20;

interface UseHistoryOptions {
  pageSize?: number;
}

interface UseHistoryReturn {
  sessions: AIHistorySessionMetadata[];
  pagination: AIHistoryListResult['pagination'] | null;
  isLoading: boolean;
  error: string | null;
  deletingIds: Set<string>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createSession: (params: {
    workflowType: WorkflowType;
    repository?: string;
    title: string;
    provider: AIProviderName;
    model: AIModel;
    messages: AIHistoryMessage[];
  }) => Promise<AIHistorySession>;
  updateSession: (
    id: string,
    updates: Partial<Pick<AIHistorySession, 'title' | 'pinned' | 'archived' | 'favorite'>>,
  ) => Promise<AIHistorySession | null>;
  deleteSession: (id: string) => Promise<boolean>;
  getSession: (id: string) => Promise<AIHistorySession | null>;
  addMessage: (sessionId: string, message: AIHistoryMessage) => Promise<AIHistorySession | null>;
  togglePin: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
}

export function useHistory(
  filters: AIHistoryFilters = {},
  options: UseHistoryOptions = {},
): UseHistoryReturn {
  const { session } = useAuth();
  const token = session?.accessToken;
  const { pageSize = DEFAULT_PAGE_SIZE } = options;
  const [sessions, setSessions] = useState<AIHistorySessionMetadata[]>([]);
  const [pagination, setPagination] = useState<AIHistoryListResult['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const currentPageRef = useRef(1);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchSessions = useCallback(
    async (page: number, append: boolean = false) => {
      if (!token) return;
      try {
        setIsLoading(true);
        setError(null);
        const result = await aiHistoryApi.listSessions(token, filtersRef.current, {
          page,
          pageSize,
        });
        setSessions((prev) => (append ? [...prev, ...result.sessions] : result.sessions));
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    },
    [token, pageSize],
  );

  useEffect(() => {
    currentPageRef.current = 1;
    fetchSessions(1, false);
  }, [fetchSessions, JSON.stringify(filters)]);

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoading || !token) return;
    currentPageRef.current += 1;
    try {
      setIsLoading(true);
      const result = await aiHistoryApi.listSessions(token, filtersRef.current, {
        page: currentPageRef.current,
        pageSize,
      });
      setSessions((prev) => [...prev, ...result.sessions]);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [pagination?.hasMore, isLoading, token, pageSize]);

  const refresh = useCallback(async () => {
    currentPageRef.current = 1;
    await fetchSessions(1, false);
  }, [fetchSessions]);

  const createSession = useCallback(
    async (params: {
      workflowType: WorkflowType;
      repository?: string;
      title: string;
      provider: AIProviderName;
      model: AIModel;
      messages: AIHistoryMessage[];
    }) => {
      if (!token) throw new Error('Not authenticated');
      const session = await aiHistoryApi.createSession(token, params);
      await refresh();
      return session;
    },
    [token, refresh],
  );

  const updateSession = useCallback(
    async (
      id: string,
      updates: Partial<Pick<AIHistorySession, 'title' | 'pinned' | 'archived' | 'favorite'>>,
    ) => {
      if (!token) return null;
      const updated = await aiHistoryApi.updateSession(token, id, updates);
      await refresh();
      return updated;
    },
    [token, refresh],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!token) return false;
      setDeletingIds((prev) => new Set(prev).add(id));
      try {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        const result = await aiHistoryApi.deleteSession(token, id);
        if (!result) {
          await refresh();
          return false;
        }
        setPagination((prev) => (prev ? { ...prev, total: prev.total - 1 } : prev));
        return true;
      } catch {
        await refresh();
        return false;
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [token, refresh],
  );

  const getSession = useCallback(
    async (id: string) => {
      if (!token) return null;
      return aiHistoryApi.getSession(token, id);
    },
    [token],
  );

  const addMessage = useCallback(
    async (sessionId: string, message: AIHistoryMessage) => {
      if (!token) return null;
      const updated = await aiHistoryApi.addMessage(token, sessionId, message);
      await refresh();
      return updated;
    },
    [token, refresh],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        await updateSession(id, { pinned: !session.pinned });
      }
    },
    [sessions, updateSession],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        await updateSession(id, { favorite: !session.favorite });
      }
    },
    [sessions, updateSession],
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        await updateSession(id, { archived: !session.archived });
      }
    },
    [sessions, updateSession],
  );

  return {
    sessions,
    pagination,
    isLoading,
    error,
    deletingIds,
    loadMore,
    refresh,
    createSession,
    updateSession,
    deleteSession,
    getSession,
    addMessage,
    togglePin,
    toggleFavorite,
    toggleArchive,
  };
}

export function useRecentHistory(limit: number = 5) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [sessions, setSessions] = useState<AIHistorySessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await aiHistoryApi.listSessions(token, {}, { page: 1, pageSize: limit });
      setSessions(result.sessions);
    } finally {
      setIsLoading(false);
    }
  }, [token, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, isLoading, refresh };
}

export function useCreateSession() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [isCreating, setIsCreating] = useState(false);

  const create = useCallback(
    async (params: {
      workflowType: WorkflowType;
      repository?: string;
      title: string;
      provider: AIProviderName;
      model: AIModel;
      messages: AIHistoryMessage[];
    }) => {
      if (!token) throw new Error('Not authenticated');
      setIsCreating(true);
      try {
        return await aiHistoryApi.createSession(token, params);
      } finally {
        setIsCreating(false);
      }
    },
    [token],
  );

  return { createSession: create, isCreating };
}
