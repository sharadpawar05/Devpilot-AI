import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { ProfileSettings } from '@/components/settings/ProfileSettings';

const mockUser = {
  id: 'supa-1',
  email: 'alice@example.com',
  name: 'Alice',
  avatarUrl: null,
  role: 'user',
  authProvider: 'google',
  createdAt: new Date().toISOString(),
};

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const savedSettings = {
  success: true,
  profile: {
    name: 'Alice',
    email: 'alice@example.com',
    avatarUrl: null,
    timezone: 'Europe/London',
  },
  ai: {},
  github: {},
  appearance: {},
  notifications: {},
};

function mockFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key] ?? routes[url];
    if (handler) {
      return {
        ok: true,
        status: 200,
        json: async () => handler,
        cookies: [],
      } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ProfileSettings />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the saved timezone instead of silently falling back to the first option', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/timezone/i) as HTMLSelectElement;
    expect(select.value).toBe('Europe/London');
  });

  it('shows email as read-only', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    });

    const email = screen.getByLabelText(/^email/i) as HTMLInputElement;
    expect(email).toBeDisabled();
    expect(email.value).toBe('alice@example.com');
  });

  it('keeps Save disabled until the form is edited, then PATCHes the profile', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      '/api/v1/settings': savedSettings,
      'PATCH /api/v1/settings/profile': savedSettings,
    });
    vi.stubGlobal('fetch', fetchMock);
    renderProfile();

    const save = await screen.findByRole('button', { name: /save changes/i });
    // Saved timezone matches (not the UTC default) → clean → disabled.
    expect(save).toBeDisabled();

    const name = screen.getByLabelText(/full name/i) as HTMLInputElement;
    await user.clear(name);
    await user.type(name, 'Alice Smith');

    await waitFor(() => {
      expect(save).toBeEnabled();
    });

    await user.click(save);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.name).toBe('Alice Smith');
      expect(body.timezone).toBe('Europe/London');
    });
  });

  it('rejects a >2MB avatar client-side without calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ '/api/v1/settings': savedSettings });
    vi.stubGlobal('fetch', fetchMock);
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText(/change avatar/i)).toBeInTheDocument();
    });

    // A 3MB PNG.
    const bigFile = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const input = screen
      .getByLabelText(/change avatar/i)
      .parentElement!.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, bigFile);

    await waitFor(() => {
      expect(screen.getByText(/under 2MB/i)).toBeInTheDocument();
    });
    const postAvatar = fetchMock.mock.calls.find(
      (c) =>
        (c[1] as RequestInit | undefined)?.method === 'POST' && String(c[0]).includes('/avatar'),
    );
    expect(postAvatar).toBeUndefined();
  });
});
