import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  NotificationProvider,
  useNotifications,
  formatRelativeTime,
} from '@/hooks/use-notifications';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A' },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

interface ServerNotification {
  id: string;
  title: string;
  description: string;
  type: string;
  read: boolean;
  timestamp: string;
}

// Stateful fake notifications API so optimistic updates reconcile correctly.
function makeServer() {
  const items: ServerNotification[] = [
    {
      id: 'n1',
      title: 'Code review completed',
      description: 'Standard review ready',
      type: 'review_complete',
      read: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'n2',
      title: 'AI analysis ready',
      description: '3 issues found',
      type: 'pr_analysis',
      read: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'n3',
      title: 'Pull request merged',
      description: 'PR #139 merged',
      type: 'github_alert',
      read: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const ok = (payload: unknown) =>
      ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;

    if (method === 'GET' && url.includes('/notifications/unread-count')) {
      return ok({ success: true, count: items.filter((n) => !n.read).length });
    }
    if (method === 'GET' && url.includes('/notifications')) {
      return ok({ success: true, notifications: items });
    }
    if (method === 'PATCH' && url.includes('/notifications/') && url.endsWith('/read')) {
      const id = url.split('/').at(-2);
      const target = items.find((n) => n.id === id);
      if (!target) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'Notification not found' } }),
        } as unknown as Response;
      }
      target.read = true;
      return ok({ success: true, notification: target });
    }
    if (method === 'POST' && url.endsWith('/notifications/read-all')) {
      items.forEach((n) => (n.read = true));
      return ok({ success: true, updated: items.length });
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });

  return { items, fetchMock };
}

function renderNotifications() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = renderHook(() => useNotifications(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NotificationProvider>{children}</NotificationProvider>
      </QueryClientProvider>
    ),
  });
  return { ...result, client };
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads notifications and the unread count from the API', async () => {
    const server = makeServer();
    vi.stubGlobal('fetch', server.fetchMock);
    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.notifications).toHaveLength(3));
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.notifications[0].title).toBe('Code review completed');
    expect(result.current.notifications[0].timestamp).toBeInstanceOf(Date);
    expect(result.current.notifications[2].read).toBe(true);
  });

  it('marks a notification as read via PATCH and reconciles the badge', async () => {
    const server = makeServer();
    vi.stubGlobal('fetch', server.fetchMock);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.notifications).toHaveLength(3));

    act(() => {
      result.current.markAsRead('n1');
    });

    // Optimistic, then reconciled with the server.
    await waitFor(() => {
      expect(result.current.notifications.find((n) => n.id === 'n1')?.read).toBe(true);
      expect(result.current.unreadCount).toBe(1);
    });
    expect(
      server.fetchMock.mock.calls.find(
        (c) => c[1] !== undefined && (c[1] as RequestInit).method === 'PATCH',
      ),
    ).toBeTruthy();
    expect(server.items.find((n) => n.id === 'n1')?.read).toBe(true);
  });

  it('marks all notifications as read via POST', async () => {
    const server = makeServer();
    vi.stubGlobal('fetch', server.fetchMock);
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => {
      result.current.markAllAsRead();
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications.every((n) => n.read)).toBe(true);
    });
    expect(
      server.fetchMock.mock.calls.find(
        (c) => c[1] !== undefined && (c[1] as RequestInit).method === 'POST',
      ),
    ).toBeTruthy();
    expect(server.items.every((n) => n.read)).toBe(true);
  });

  it('shows an empty list when the API returns nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const payload = url.includes('unread-count')
          ? { success: true, count: 0 }
          : { success: true, notifications: [] };
        return { ok: true, status: 200, json: async () => payload } as unknown as Response;
      }),
    );
    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });
});

describe('formatRelativeTime', () => {
  it('should format recent time as "Just now"', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('Just now');
  });

  it('should format minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 1000 * 60 * 5);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('should format hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 2);
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('should format days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});
