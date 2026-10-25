import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

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
  appearance: {},
  notifications: {
    notifyReviewComplete: true,
    notifyPrAnalysis: true,
    notifyRepositorySync: false,
    notifyGithubAlerts: true,
    notifyWeeklySummary: false,
  },
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

function renderNotificationsSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NotificationsSettings />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('NotificationsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the saved notification preferences', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderNotificationsSettings();

    expect(await screen.findByRole('button', { name: /save preferences/i })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Review Complete' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'PR Analysis' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Repository Sync' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'GitHub Alerts' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Weekly Summary' })).not.toBeChecked();
  });

  it('PATCHes the full payload when a preference is toggled and saved', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      '/api/v1/settings': savedSettings,
      'PATCH /api/v1/settings/notifications': {
        ...savedSettings,
        notifications: { ...savedSettings.notifications, notifyWeeklySummary: true },
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderNotificationsSettings();

    const save = await screen.findByRole('button', { name: /save preferences/i });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('switch', { name: 'Weekly Summary' }));
    expect(screen.getByRole('switch', { name: 'Weekly Summary' })).toBeChecked();
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(await screen.findByText('Notification preferences saved')).toBeInTheDocument();

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse((patch![1] as RequestInit).body as string);
      expect(body).toEqual({
        notifyReviewComplete: true,
        notifyPrAnalysis: true,
        notifyRepositorySync: false,
        notifyGithubAlerts: true,
        notifyWeeklySummary: true,
      });
    });
  });

  it('shows an inline error when saving fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Persistence unavailable' } }),
          } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => savedSettings } as unknown as Response;
      }),
    );
    renderNotificationsSettings();

    const save = await screen.findByRole('button', { name: /save preferences/i });
    await user.click(screen.getByRole('switch', { name: 'Repository Sync' }));
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(await screen.findByText('Persistence unavailable')).toBeInTheDocument();
  });
});
