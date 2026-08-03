import { useState, useCallback, useEffect, useRef } from 'react';
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
import { aiHistoryStorage } from '@/lib/ai-history';

const DEFAULT_PAGE_SIZE = 20;

interface UseHistoryOptions {
  pageSize?: number;
  autoRefresh?: boolean;
}

interface UseHistoryReturn {
  sessions: AIHistorySessionMetadata[];
  pagination: AIHistoryListResult['pagination'] | null;
  isLoading: boolean;
  error: string | null;
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
  const { pageSize = DEFAULT_PAGE_SIZE } = options;
  const [sessions, setSessions] = useState<AIHistorySessionMetadata[]>([]);
  const [pagination, setPagination] = useState<AIHistoryListResult['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPageRef = useRef(1);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchSessions = useCallback(
    async (page: number, append: boolean = false) => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await aiHistoryStorage.listSessions(filtersRef.current, {
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
    [pageSize],
  );

  useEffect(() => {
    currentPageRef.current = 1;
    fetchSessions(1, false);
  }, [fetchSessions, JSON.stringify(filters)]);

  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoading) return;
    currentPageRef.current += 1;
    await fetchSessions(currentPageRef.current, true);
  }, [pagination?.hasMore, isLoading, fetchSessions]);

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
      const session = await aiHistoryStorage.createSession(params);
      await refresh();
      return session;
    },
    [refresh],
  );

  const updateSession = useCallback(
    async (
      id: string,
      updates: Partial<Pick<AIHistorySession, 'title' | 'pinned' | 'archived' | 'favorite'>>,
    ) => {
      const updated = await aiHistoryStorage.updateSession(id, updates);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const result = await aiHistoryStorage.deleteSession(id);
      await refresh();
      return result;
    },
    [refresh],
  );

  const getSession = useCallback(async (id: string) => {
    return aiHistoryStorage.getSession(id);
  }, []);

  const addMessage = useCallback(
    async (sessionId: string, message: AIHistoryMessage) => {
      const updated = await aiHistoryStorage.addMessage(sessionId, message);
      await refresh();
      return updated;
    },
    [refresh],
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
  const [sessions, setSessions] = useState<AIHistorySessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const recent = await aiHistoryStorage.getRecentActivity(limit);
    setSessions(recent);
    setIsLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, isLoading, refresh };
}

export function useCreateSession() {
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
      setIsCreating(true);
      try {
        return await aiHistoryStorage.createSession(params);
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  return { createSession: create, isCreating };
}
