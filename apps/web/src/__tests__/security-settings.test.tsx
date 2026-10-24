import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { SecuritySettings } from '@/components/settings/SecuritySettings';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A', avatarUrl: null },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const currentSession = {
  id: 's1',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 10).toISOString(),
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  ip: '203.0.113.9',
  current: true,
};

const otherSession = {
  id: 's2',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  ip: '198.51.100.4',
  current: false,
};

// Stateful fake sessions API: revoking others actually removes them so the
// post-mutation refetch reflects the server.
function makeServer(sessions: (typeof currentSession)[]) {
  let state = [...sessions];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const ok = (payload: unknown) =>
      ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;
    if (method === 'GET' && url.includes('/settings/account-sessions')) {
      return ok({
        success: true,
        supported: true,
        currentSessionId: 's1',
        sessions: state,
      });
    }
    if (method === 'POST' && url.includes('/settings/account-sessions/revoke-others')) {
      const revoked = state.filter((s) => !s.current).length;
      state = state.filter((s) => s.current);
      return ok({ success: true, revoked });
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
  return { fetchMock, getState: () => state };
}

function renderSecurity() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SecuritySettings />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('SecuritySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the real session list with the current session marked', async () => {
    const server = makeServer([currentSession, otherSession]);
    vi.stubGlobal('fetch', server.fetchMock);
    renderSecurity();

    // Current session pinned first with a "Current" badge.
    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.9 · This device')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    expect(screen.getByText('Firefox on Windows')).toBeInTheDocument();
    expect(screen.getByText('198.51.100.4 · 42m ago')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Sign Out Other Sessions (1)' })).toBeInTheDocument();
    // No dead password controls on an OAuth-only app.
    expect(screen.queryByRole('button', { name: /change password/i })).toBeNull();
  });

  it('signs out other sessions and refreshes the list', async () => {
    const user = userEvent.setup();
    const server = makeServer([currentSession, otherSession]);
    vi.stubGlobal('fetch', server.fetchMock);
    renderSecurity();

    const revoke = await screen.findByRole('button', {
      name: 'Sign Out Other Sessions (1)',
    });
    await user.click(revoke);

    expect(await screen.findByText('Signed out 1 other session')).toBeInTheDocument();
    expect(server.getState()).toHaveLength(1);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /sign out other sessions/i })).toBeNull();
    });
    expect(screen.getByText('No other active sessions.')).toBeInTheDocument();
    expect(
      server.fetchMock.mock.calls.some(
        (c) => c[1] !== undefined && (c[1] as RequestInit).method === 'POST',
      ),
    ).toBe(true);
  });

  it('degrades gracefully when session management is unsupported', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              supported: false,
              currentSessionId: null,
              sessions: [],
            }),
          }) as unknown as Response,
      ),
    );
    renderSecurity();

    expect(await screen.findByText(/session management isn't available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out other sessions/i })).toBeNull();
    expect(screen.queryByText('This device')).toBeNull();
  });
});
