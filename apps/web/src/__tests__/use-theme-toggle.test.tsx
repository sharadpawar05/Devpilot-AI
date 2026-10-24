import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme';
import { useThemeToggle } from '@/hooks/use-theme-toggle';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A' },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const savedSettings = {
  success: true,
  profile: {},
  ai: {},
  github: {},
  appearance: { theme: 'light', compactMode: false, fontSize: 'default', accentColor: 'blue' },
  notifications: {},
};

function mockFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key] ?? routes[url];
    if (handler) {
      return { ok: true, status: 200, json: async () => handler } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

function renderToggle() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => useThemeToggle(), { wrapper });
  return { ...view, client };
}

const patchCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');

describe('useThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('toggles instantly and persists the full appearance payload', async () => {
    localStorage.setItem('theme', 'light');
    const fetchMock = mockFetch({ '/api/v1/settings': savedSettings });
    vi.stubGlobal('fetch', fetchMock);
    const { result, client } = renderToggle();

    // Wait for settings to load so the choice can be persisted.
    await waitFor(() => expect(client.getQueryData(['settings'])).toBeTruthy());

    act(() => result.current.toggle());

    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    const body = JSON.parse((patchCalls(fetchMock)[0][1] as RequestInit).body as string);
    expect(body).toEqual({ ...savedSettings.appearance, theme: 'dark' });
  });

  it('stays local-only when settings are unavailable', async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderToggle();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => result.current.toggle());

    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    // No PATCH should be attempted without saved settings.
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it('rolls the optimistic change back when persisting fails', async () => {
    localStorage.setItem('theme', 'light');
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'boom' } }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => savedSettings } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, client } = renderToggle();

    await waitFor(() => expect(client.getQueryData(['settings'])).toBeTruthy());

    act(() => result.current.toggle());
    expect(localStorage.getItem('theme')).toBe('dark'); // optimistic

    await waitFor(() => expect(localStorage.getItem('theme')).toBe('light'));
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
