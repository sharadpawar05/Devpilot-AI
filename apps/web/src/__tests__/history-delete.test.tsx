import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '@/hooks/use-history';
import type { ReactNode } from 'react';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    session: { accessToken: 'test-token' },
  }),
}));

const mockListSessions = vi.fn().mockResolvedValue({
  sessions: [
    {
      id: 'session-1',
      workflowType: 'code-review',
      title: 'Test Session',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 5,
      pinned: false,
      favorite: false,
      archived: false,
    },
  ],
  pagination: { total: 1, page: 1, limit: 20, hasMore: false },
});

const mockDeleteSession = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/ai-history', () => ({
  aiHistoryApi: {
    listSessions: (...args: unknown[]) => mockListSessions(...args),
    deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

describe('useHistory - Delete Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue({
      sessions: [
        {
          id: 'session-1',
          workflowType: 'code-review',
          title: 'Test Session',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 5,
          pinned: false,
          favorite: false,
          archived: false,
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, hasMore: false },
    });
  });

  it('should track deleting state', async () => {
    const { result } = renderHook(() => useHistory({}), { wrapper });

    expect(result.current.deletingIds.size).toBe(0);
  });

  it('should return true on successful delete', async () => {
    const { result } = renderHook(() => useHistory({}), { wrapper });

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.deleteSession('session-1');
    });

    expect(deleteResult).toBe(true);
  });

  it('should call deleteSession API', async () => {
    const { result } = renderHook(() => useHistory({}), { wrapper });

    await act(async () => {
      await result.current.deleteSession('session-1');
    });

    expect(mockDeleteSession).toHaveBeenCalledWith('test-token', 'session-1');
  });
});
