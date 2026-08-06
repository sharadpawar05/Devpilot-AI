import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  NotificationProvider,
  useNotifications,
  formatRelativeTime,
} from '@/hooks/use-notifications';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with mock notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.notifications).toHaveLength(4);
    expect(result.current.unreadCount).toBe(2);
  });

  it('should mark a notification as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.markAsRead('1');
    });

    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications.find((n) => n.id === '1')?.read).toBe(true);
  });

  it('should mark all notifications as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('should add a new notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        title: 'New notification',
        description: 'Test description',
      });
    });

    expect(result.current.notifications).toHaveLength(5);
    expect(result.current.notifications[0].title).toBe('New notification');
    expect(result.current.notifications[0].read).toBe(false);
  });

  it('should remove a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.removeNotification('1');
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.notifications.find((n) => n.id === '1')).toBeUndefined();
  });

  it('should persist read status to localStorage', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.markAsRead('1');
    });

    const stored = JSON.parse(localStorage.getItem('devpilot_notifications') || '[]');
    expect(stored.find((n: { id: string }) => n.id === '1').read).toBe(true);
  });

  it('should load persisted state from localStorage', () => {
    const mockData = [
      {
        id: '1',
        title: 'Test',
        description: 'Test',
        timestamp: new Date().toISOString(),
        read: true,
      },
      {
        id: '2',
        title: 'Test 2',
        description: 'Test 2',
        timestamp: new Date().toISOString(),
        read: false,
      },
    ];
    localStorage.setItem('devpilot_notifications', JSON.stringify(mockData));

    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('should update unread count after marking as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAsRead('1');
    });

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markAsRead('2');
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should handle marking already read notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.markAsRead('3'); // Already read
    });

    expect(result.current.unreadCount).toBe(2); // No change
  });

  it('should handle non-existent notification id', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.markAsRead('999');
    });

    expect(result.current.unreadCount).toBe(2); // No change
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
