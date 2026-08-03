import type {
  AIHistorySession,
  AIHistorySessionMetadata,
  AIHistoryFilters,
  AIHistoryListResult,
} from '@devpilot/types';
import { generateId } from '@/lib/id';

const METADATA_KEY = 'devpilot_ai_history_metadata';
const DB_NAME = 'devpilot_ai_history';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const MAX_METADATA_ENTRIES = 500;

function getMetadataIndex(): AIHistorySessionMetadata[] {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMetadataIndex(metadata: AIHistorySessionMetadata[]): void {
  const trimmed = metadata.slice(0, MAX_METADATA_ENTRIES);
  localStorage.setItem(METADATA_KEY, JSON.stringify(trimmed));
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function getSessionContent(id: string): Promise<AIHistorySession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

async function saveSessionContent(session: AIHistorySession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(session);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function deleteSessionContent(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function matchesFilters(session: AIHistorySessionMetadata, filters: AIHistoryFilters): boolean {
  if (filters.workflowType?.length && !filters.workflowType.includes(session.workflowType)) {
    return false;
  }
  if (
    filters.repository?.length &&
    session.repository &&
    !filters.repository.includes(session.repository)
  ) {
    return false;
  }
  if (filters.provider?.length && !filters.provider.includes(session.provider)) {
    return false;
  }
  if (filters.dateFrom && session.createdAt < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && session.createdAt > filters.dateTo) {
    return false;
  }
  if (filters.favorite !== undefined && session.favorite !== filters.favorite) {
    return false;
  }
  if (filters.pinned !== undefined && session.pinned !== filters.pinned) {
    return false;
  }
  if (filters.archived !== undefined && session.archived !== filters.archived) {
    return false;
  }
  return true;
}

function matchesSearch(session: AIHistorySessionMetadata, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.toLowerCase();
  const matchesTitle = session.title.toLowerCase().includes(lower);
  const matchesRepo = session.repository ? session.repository.toLowerCase().includes(lower) : false;
  return matchesTitle || matchesRepo;
}

function sortSessions(sessions: AIHistorySessionMetadata[]): AIHistorySessionMetadata[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export const aiHistoryStorage = {
  async createSession(
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
    const now = new Date().toISOString();
    const totalLatency = session.messages.reduce((sum, m) => sum + m.latency, 0);
    const totalTokens = session.messages.reduce((sum, m) => sum + m.tokens, 0);
    const fullSession: AIHistorySession = {
      ...session,
      totalLatency,
      totalTokens,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      favorite: false,
    };

    await saveSessionContent(fullSession);

    const metadata: AIHistorySessionMetadata = {
      id: fullSession.id,
      workflowType: fullSession.workflowType,
      repository: fullSession.repository,
      title: fullSession.title,
      provider: fullSession.provider,
      model: fullSession.model,
      totalLatency: fullSession.totalLatency,
      totalTokens: fullSession.totalTokens,
      messageCount: fullSession.messages.length,
      createdAt: fullSession.createdAt,
      updatedAt: fullSession.updatedAt,
      pinned: fullSession.pinned,
      archived: fullSession.archived,
      favorite: fullSession.favorite,
    };

    const index = getMetadataIndex();
    index.unshift(metadata);
    saveMetadataIndex(index);

    return fullSession;
  },

  async updateSession(
    id: string,
    updates: Partial<
      Pick<AIHistorySession, 'title' | 'pinned' | 'archived' | 'favorite' | 'messages'>
    >,
  ): Promise<AIHistorySession | null> {
    const session = await getSessionContent(id);
    if (!session) return null;

    const updated: AIHistorySession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.messages) {
      updated.totalLatency = updates.messages.reduce((sum, m) => sum + m.latency, 0);
      updated.totalTokens = updates.messages.reduce((sum, m) => sum + m.tokens, 0);
    }

    await saveSessionContent(updated);

    const index = getMetadataIndex();
    const metaIdx = index.findIndex((m) => m.id === id);
    if (metaIdx !== -1) {
      index[metaIdx] = {
        ...index[metaIdx],
        title: updated.title,
        pinned: updated.pinned,
        archived: updated.archived,
        favorite: updated.favorite,
        updatedAt: updated.updatedAt,
        totalLatency: updated.totalLatency,
        totalTokens: updated.totalTokens,
        messageCount: updated.messages.length,
      };
      saveMetadataIndex(index);
    }

    return updated;
  },

  async deleteSession(id: string): Promise<boolean> {
    await deleteSessionContent(id);
    const index = getMetadataIndex();
    const filtered = index.filter((m) => m.id !== id);
    saveMetadataIndex(filtered);
    return true;
  },

  async getSession(id: string): Promise<AIHistorySession | null> {
    return getSessionContent(id);
  },

  async listSessions(
    filters: AIHistoryFilters = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 },
  ): Promise<AIHistoryListResult> {
    let index = getMetadataIndex();

    index = index.filter((s) => matchesFilters(s, filters));

    if (filters.search) {
      const searchQuery = filters.search;
      index = index.filter((s) => matchesSearch(s, searchQuery));
    }

    index = sortSessions(index);

    const total = index.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    const sessions = index.slice(start, end);

    return {
      sessions,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        hasMore: end < total,
      },
    };
  },

  async getRecentActivity(limit: number = 5): Promise<AIHistorySessionMetadata[]> {
    const index = getMetadataIndex();
    return sortSessions(index.filter((s) => !s.archived)).slice(0, limit);
  },

  async searchSessions(query: string, limit: number = 20): Promise<AIHistorySessionMetadata[]> {
    const index = getMetadataIndex();
    return sortSessions(index.filter((s) => matchesSearch(s, query))).slice(0, limit);
  },

  async addMessage(
    sessionId: string,
    message: AIHistorySession['messages'][0],
  ): Promise<AIHistorySession | null> {
    const session = await getSessionContent(sessionId);
    if (!session) return null;

    session.messages.push(message);
    session.totalLatency = session.messages.reduce((sum, m) => sum + m.latency, 0);
    session.totalTokens = session.messages.reduce((sum, m) => sum + m.tokens, 0);
    session.updatedAt = new Date().toISOString();

    await saveSessionContent(session);

    const index = getMetadataIndex();
    const metaIdx = index.findIndex((m) => m.id === sessionId);
    if (metaIdx !== -1) {
      index[metaIdx].totalLatency = session.totalLatency;
      index[metaIdx].totalTokens = session.totalTokens;
      index[metaIdx].messageCount = session.messages.length;
      index[metaIdx].updatedAt = session.updatedAt;
      saveMetadataIndex(index);
    }

    return session;
  },

  async getUniqueRepositories(): Promise<string[]> {
    const index = getMetadataIndex();
    const repos = new Set<string>();
    index.forEach((s) => {
      if (s.repository) repos.add(s.repository);
    });
    return Array.from(repos).sort();
  },

  async clearAll(): Promise<void> {
    localStorage.removeItem(METADATA_KEY);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },
};
