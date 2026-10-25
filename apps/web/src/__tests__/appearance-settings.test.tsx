import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A', avatarUrl: null },
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
  appearance: { theme: 'dark', compactMode: true, fontSize: 'large', accentColor: 'purple' },
  notifications: {},
};

const updatedSettings = {
  ...savedSettings,
  appearance: { theme: 'light', compactMode: true, fontSize: 'large', accentColor: 'blue' },
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

function AppearanceHost({ visible }: { visible: boolean }) {
  return visible ? <AppearanceSettings /> : null;
}

function renderAppearance(initialVisible = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>
          <AppearanceHost visible={initialVisible} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return {
    ...view,
    hide: () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <ThemeProvider>
            <ToastProvider>
              <AppearanceHost visible={false} />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>,
      ),
  };
}

function resetDocument() {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-font-size');
  document.documentElement.removeAttribute('data-compact');
  document.documentElement.removeAttribute('data-accent');
  localStorage.clear();
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDocument();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetDocument();
  });

  it('renders the saved appearance preferences', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderAppearance();

    expect(await screen.findByRole('button', { name: /save appearance/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('switch', { name: 'Compact mode' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Large' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Purple' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('previews changes live and PATCHes the full appearance payload on save', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      '/api/v1/settings': savedSettings,
      'PATCH /api/v1/settings/appearance': updatedSettings,
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAppearance();

    const save = await screen.findByRole('button', { name: /save appearance/i });
    expect(save).toBeDisabled();

    // Live preview: theme class + document attributes change immediately.
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.classList.contains('light')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue');

    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(await screen.findByText('Appearance preferences saved')).toBeInTheDocument();

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse((patch![1] as RequestInit).body as string);
      expect(body).toEqual({
        theme: 'light',
        compactMode: true,
        fontSize: 'large',
        accentColor: 'blue',
      });
    });
  });

  it('reverts unsaved preview changes when the tab unmounts', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    const view = renderAppearance();

    await screen.findByRole('button', { name: /save appearance/i });
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue');

    view.hide();

    // Persisted values are restored so the document matches the server.
    expect(document.documentElement.getAttribute('data-accent')).toBe('purple');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
