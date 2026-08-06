import type {
  AIHistorySession,
  AIHistorySessionMetadata,
  AIHistoryFilters,
  AIHistoryListResult,
} from '@devpilot/types';
import { generateId } from '@/lib/id';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

async function apiFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'API request failed');
  }
  return data;
}

export const aiHistoryApi = {
  async createSession(
    token: string,
    session: Omit<
      AIHistorySession,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'pinned'
      | 'archived'
      | 'favorite'
      | 'totalLatency'
      | 'totalTokens'
    >,
  ): Promise<AIHistorySession> {
    const data = await apiFetch<{
      success: boolean;
      id: string;
      workflowType: string;
      repository: string | null;
      title: string;
      provider: string;
      model: string;
      totalLatency: number;
      totalTokens: number;
      pinned: boolean;
      archived: boolean;
      favorite: boolean;
      createdAt: string;
      updatedAt: string;
      messages: Array<{
        id: string;
        role: string;
        content: string;
        latency: number;
        tokens: number;
        timestamp: string;
      }>;
    }>(`${API_BASE_URL}/ai-history/sessions`, token, {
      method: 'POST',
      body: JSON.stringify(session),
    });

    return {
      id: data.id,
      workflowType: data.workflowType as AIHistorySession['workflowType'],
      repository: data.repository ?? undefined,
      title: data.title,
      provider: data.provider as AIHistorySession['provider'],
      model: data.model as AIHistorySession['model'],
      totalLatency: data.totalLatency,
      totalTokens: data.totalTokens,
      pinned: data.pinned,
      archived: data.archived,
      favorite: data.favorite,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      messages: data.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        latency: m.latency,
        tokens: m.tokens,
        timestamp: m.timestamp,
      })),
    };
  },

  async listSessions(
    token: string,
    filters: AIHistoryFilters = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 },
  ): Promise<AIHistoryListResult> {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('pageSize', String(pagination.pageSize));

    if (filters.workflowType?.length) {
      params.set('workflowType', filters.workflowType.join(','));
    }
    if (filters.repository?.length) {
      params.set('repository', filters.repository.join(','));
    }
    if (filters.provider?.length) {
      params.set('provider', filters.provider.join(','));
    }
    if (filters.favorite !== undefined) {
      params.set('favorite', String(filters.favorite));
    }
    if (filters.pinned !== undefined) {
      params.set('pinned', String(filters.pinned));
    }
    if (filters.archived !== undefined) {
      params.set('archived', String(filters.archived));
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    if (filters.dateFrom) {
      params.set('dateFrom', filters.dateFrom);
    }
    if (filters.dateTo) {
      params.set('dateTo', filters.dateTo);
    }

    const data = await apiFetch<{
      success: boolean;
      sessions: Array<{
        id: string;
        workflowType: string;
        repository: string | null;
        title: string;
        provider: string;
        model: string;
        totalLatency: number;
        totalTokens: number;
        messageCount: number;
        pinned: boolean;
        archived: boolean;
        favorite: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        hasMore: boolean;
      };
    }>(`${API_BASE_URL}/ai-history/sessions?${params.toString()}`, token);

    return {
      sessions: data.sessions.map((s) => ({
        id: s.id,
        workflowType: s.workflowType as AIHistorySessionMetadata['workflowType'],
        repository: s.repository ?? undefined,
        title: s.title,
        provider: s.provider as AIHistorySessionMetadata['provider'],
        model: s.model as AIHistorySessionMetadata['model'],
        totalLatency: s.totalLatency,
        totalTokens: s.totalTokens,
        messageCount: s.messageCount,
        pinned: s.pinned,
        archived: s.archived,
        favorite: s.favorite,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      pagination: data.pagination,
    };
  },

  async getSession(token: string, id: string): Promise<AIHistorySession | null> {
    try {
      const data = await apiFetch<{
        success: boolean;
        id: string;
        workflowType: string;
        repository: string | null;
        title: string;
        provider: string;
        model: string;
        totalLatency: number;
        totalTokens: number;
        pinned: boolean;
        archived: boolean;
        favorite: boolean;
        createdAt: string;
        updatedAt: string;
        messages: Array<{
          id: string;
          role: string;
          content: string;
          latency: number;
          tokens: number;
          timestamp: string;
        }>;
      }>(`${API_BASE_URL}/ai-history/sessions/${id}`, token);

      return {
        id: data.id,
        workflowType: data.workflowType as AIHistorySession['workflowType'],
        repository: data.repository ?? undefined,
        title: data.title,
        provider: data.provider as AIHistorySession['provider'],
        model: data.model as AIHistorySession['model'],
        totalLatency: data.totalLatency,
        totalTokens: data.totalTokens,
        pinned: data.pinned,
        archived: data.archived,
        favorite: data.favorite,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        messages: data.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          latency: m.latency,
          tokens: m.tokens,
          timestamp: m.timestamp,
        })),
      };
    } catch {
      return null;
    }
  },

  async updateSession(
    token: string,
    id: string,
    updates: Partial<Pick<AIHistorySession, 'title' | 'pinned' | 'archived' | 'favorite'>>,
  ): Promise<AIHistorySession | null> {
    try {
      const data = await apiFetch<{
        success: boolean;
        id: string;
        pinned: boolean;
        archived: boolean;
        favorite: boolean;
        title: string;
        updatedAt: string;
      }>(`${API_BASE_URL}/ai-history/sessions/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      return {
        id: data.id,
        workflowType: 'playground',
        title: data.title,
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: data.pinned,
        archived: data.archived,
        favorite: data.favorite,
        createdAt: new Date().toISOString(),
        updatedAt: data.updatedAt,
        messages: [],
      };
    } catch {
      return null;
    }
  },

  async deleteSession(token: string, id: string): Promise<boolean> {
    try {
      await apiFetch<{ success: boolean }>(`${API_BASE_URL}/ai-history/sessions/${id}`, token, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  },

  async getUniqueRepositories(token: string): Promise<string[]> {
    try {
      const data = await apiFetch<{
        success: boolean;
        repositories: string[];
      }>(`${API_BASE_URL}/ai-history/repositories`, token);

      return data.repositories.filter(Boolean);
    } catch {
      return [];
    }
  },

  async addMessage(
    token: string,
    sessionId: string,
    message: { role: string; content: string; latency: number; tokens: number },
  ): Promise<AIHistorySession | null> {
    const session = await aiHistoryApi.getSession(token, sessionId);
    if (!session) return null;

    session.messages.push({
      id: generateId(),
      role: message.role as 'user' | 'assistant',
      content: message.content,
      latency: message.latency,
      tokens: message.tokens,
      timestamp: new Date().toISOString(),
    });

    return aiHistoryApi.updateSession(token, sessionId, {});
  },
};
