import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { DangerZoneSettings } from '@/components/settings/DangerZoneSettings';

const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'supa-1',
      email: 'a@example.com',
      name: 'A',
      avatarUrl: null,
      authProvider: 'google',
    },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
    signInWithOAuth: mockSignInWithOAuth,
    signOut: mockSignOut,
  }),
}));

const mockDisconnect = vi.fn();
vi.mock('@/hooks/use-github', () => ({
  useGitHub: () => ({
    connected: true,
    disconnect: mockDisconnect,
    disconnecting: false,
    refreshConnection: vi.fn(),
  }),
}));

const PENDING_KEY = 'devpilot_account_delete_flow';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

// Stateful fake API covering the challenge/DELETE pair plus paginated
// history listing and batch delete.
function makeServer(
  opts: {
    historyIds?: string[];
    challengeOk?: boolean;
    accountDeleteOk?: boolean;
    historyDeleteFails?: boolean;
  } = {},
) {
  const historyIds = opts.historyIds ?? [];
  const challengeCalls: unknown[] = [];
  const accountDeleteCalls: unknown[] = [];
  const historyDeleteCalls: string[][] = [];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const ok = (payload: unknown) =>
      ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;
    const fail = (status: number, payload: unknown) =>
      ({ ok: false, status, json: async () => payload }) as unknown as Response;

    if (method === 'POST' && url.includes('/settings/account/delete-challenge')) {
      challengeCalls.push(url);
      if (opts.challengeOk === false) {
        return fail(429, { success: false, error: { message: 'Too many requests' } });
      }
      return ok({ success: true });
    }

    if (method === 'DELETE' && url.includes('/settings/account') && !url.includes('sessions')) {
      accountDeleteCalls.push(init?.body ? JSON.parse(String(init.body)) : null);
      if (opts.accountDeleteOk === false) {
        return fail(403, {
          success: false,
          error: { message: 'Sign out and sign back in to confirm deletion' },
        });
      }
      return ok({ success: true });
    }

    if (method === 'DELETE' && url.includes('/ai-history/sessions')) {
      const body = init?.body ? JSON.parse(String(init.body)) : { ids: [] };
      historyDeleteCalls.push(body.ids ?? []);
      if (opts.historyDeleteFails) return ok({ success: true, deleted: 0 });
      return ok({ success: true, deleted: (body.ids ?? []).length });
    }

    if (method === 'GET' && url.includes('/ai-history/sessions')) {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page') ?? '1');
      const sessions = page === 1 ? historyIds.map((id) => ({ id })) : [];
      return ok({
        success: true,
        sessions,
        pagination: {
          page,
          pageSize: 100,
          total: historyIds.length,
          hasMore: false,
        },
      });
    }

    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });

  return { fetchMock, challengeCalls, accountDeleteCalls, historyDeleteCalls };
}

function renderDangerZone() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/settings?tab=danger-zone']}>
          <Routes>
            <Route
              path="/settings"
              element={
                <>
                  <LocationProbe />
                  <DangerZoneSettings />
                </>
              }
            />
            <Route path="/login" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('DangerZoneSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('clears history via the server then clears local storage', async () => {
    const user = userEvent.setup();
    const server = makeServer({ historyIds: ['h1', 'h2', 'h3'] });
    vi.stubGlobal('fetch', server.fetchMock);
    renderDangerZone();

    await user.click(await screen.findByRole('button', { name: 'Clear History' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('AI conversation history cleared')).toBeInTheDocument();
    expect(server.historyDeleteCalls).toEqual([['h1', 'h2', 'h3']]);
    // The old bug wiped all settings too — that is gone: only history flows.
    expect(server.accountDeleteCalls).toHaveLength(0);
  });

  it('shows an inline error when history deletion fails', async () => {
    const user = userEvent.setup();
    const server = makeServer({ historyIds: ['h1'], historyDeleteFails: true });
    vi.stubGlobal('fetch', server.fetchMock);
    renderDangerZone();

    await user.click(await screen.findByRole('button', { name: 'Clear History' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete conversation history',
    );
    expect(screen.queryByText('AI conversation history cleared')).toBeNull();
  });

  it('issues the delete challenge and starts re-authentication on continue', async () => {
    const user = userEvent.setup();
    const server = makeServer({ challengeOk: true });
    vi.stubGlobal('fetch', server.fetchMock);
    renderDangerZone();

    await user.click(await screen.findByRole('button', { name: 'Delete Account' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith('google', {
        redirectTo: expect.stringContaining('/settings?tab=danger'),
        forceLogin: true,
      });
    });
    expect(server.challengeCalls).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!).ts).toBeTypeOf('number');
    // Never deletes in step one — re-auth must happen first.
    expect(server.accountDeleteCalls).toHaveLength(0);
  });

  it('deletes the account after re-authentication and leaves for login', async () => {
    const user = userEvent.setup();
    const server = makeServer({ accountDeleteOk: true });
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ts: Date.now() }));
    vi.stubGlobal('fetch', server.fetchMock);
    renderDangerZone();

    // Re-authenticated state is visible up front.
    expect(await screen.findByText(/re-authentication confirmed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));
    await user.click(screen.getByRole('button', { name: 'Confirm & Delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(server.accountDeleteCalls).toEqual([{ confirm: true }]);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('recovers to step one when re-authentication did not happen', async () => {
    const user = userEvent.setup();
    const server = makeServer({ accountDeleteOk: false });
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ts: Date.now() }));
    vi.stubGlobal('fetch', server.fetchMock);
    renderDangerZone();

    await user.click(await screen.findByRole('button', { name: 'Delete Account' }));
    await user.click(screen.getByRole('button', { name: 'Confirm & Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/re-authentication expired/i);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/settings?tab=danger-zone');
    // Back to step one: the flow must ask for sign-in again.
    expect(screen.getByText(/asked to sign in again to confirm/i)).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
