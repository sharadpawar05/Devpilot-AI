import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { useApiFetch, unwrap } from '@/lib/api-fetch';

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationsListResponse {
  success: boolean;
  notifications: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    timestamp: string;
  }>;
}

interface UnreadCountResponse {
  success: boolean;
  count: number;
}

const LIST_KEY = ['notifications'] as const;
const COUNT_KEY = ['notifications', 'unread-count'] as const;

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * In-app notifications backed by the API (GET /notifications, unread-count,
 * PATCH read, POST read-all). Optimistic read updates reconcile with the
 * server on settle.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const apiFetch = useApiFetch();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<Notification[]> => {
      const body = await apiFetch('/notifications').then(unwrap<NotificationsListResponse>);
      return body.notifications.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        read: n.read,
        timestamp: new Date(n.timestamp),
      }));
    },
    enabled: !!session,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const countQuery = useQuery({
    queryKey: COUNT_KEY,
    queryFn: async (): Promise<number> => {
      const body = await apiFetch('/notifications/unread-count').then(unwrap<UnreadCountResponse>);
      return body.count;
    },
    enabled: !!session,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).then(
        unwrap<{ success: boolean }>,
      ),
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      apiFetch('/notifications/read-all', { method: 'POST' }).then(unwrap<{ success: boolean }>),
  });

  const reconcile = () => queryClient.invalidateQueries({ queryKey: LIST_KEY });

  const markAsRead = (id: string) => {
    // Optimistic: flip the item and decrement the badge immediately, then
    // reconcile both queries with the server on settle.
    const target = queryClient.getQueryData<Notification[]>(LIST_KEY)?.find((n) => n.id === id);
    if (target && !target.read) {
      queryClient.setQueryData<number>(COUNT_KEY, (count) => Math.max(0, (count ?? 1) - 1));
    }
    queryClient.setQueryData<Notification[]>(LIST_KEY, (old) =>
      old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    markReadMutation.mutate(id, { onSettled: reconcile });
  };

  const markAllAsRead = () => {
    queryClient.setQueryData<Notification[]>(LIST_KEY, (old) =>
      old?.map((n) => ({ ...n, read: true })),
    );
    queryClient.setQueryData<number>(COUNT_KEY, 0);
    markAllMutation.mutate(undefined, { onSettled: reconcile });
  };

  const value: NotificationContextValue = {
    notifications: listQuery.data ?? [],
    unreadCount: countQuery.data ?? 0,
    isLoading: listQuery.isLoading,
    markAsRead,
    markAllAsRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
