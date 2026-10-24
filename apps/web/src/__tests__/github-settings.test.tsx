import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { GitHubSettings } from '@/components/settings/GitHubSettings';

const connect = vi.fn();
const disconnect = vi.fn();

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A', avatarUrl: null },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock('@/hooks/use-github', () => ({
  useGitHub: () => ({
    connected: true,
    githubUser: { login: 'alice', avatar_url: 'https://x/a.png', name: 'Alice' },
    repositories: [{ full_name: 'alice/app' }, { full_name: 'alice/api' }],
    branches: [],
    disconnecting: false,
    connect,
    disconnect,
    refreshConnection: vi.fn(),
  }),
}));

const savedSettings = {
  success: true,
  profile: { name: 'A', email: 'a@example.com', avatarUrl: null, timezone: 'UTC' },
  ai: {},
  github: { defaultRepository: 'alice/api', defaultBranch: 'main' },
  appearance: {},
  notifications: {},
};

function mockFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    const handler = routes[key] ?? routes[url];
    if (handler) {
      return { ok: true, status: 200, json: async () => handler } as unknown as Response;
    }
    // Allow prefix match for the branches endpoint (encoding tolerant).
    const prefix = Object.keys(routes).find(
      (k) => k.startsWith('GET ') && url.includes(k.slice(4)),
    );
    if (prefix) {
      return { ok: true, status: 200, json: async () => routes[prefix] } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

function renderGH() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <GitHubSettings />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('GitHubSettings', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the saved default repository and branch', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/v1/settings': savedSettings,
        'GET /api/v1/github/repositories/alice/api/branches': {
          success: true,
          branches: [{ name: 'main' }, { name: 'dev' }],
        },
      }),
    );
    renderGH();

    await waitFor(() => {
      expect(screen.getByLabelText(/default repository/i)).toBeInTheDocument();
    });

    expect((screen.getByLabelText(/default repository/i) as HTMLSelectElement).value).toBe(
      'alice/api',
    );
    expect((screen.getByLabelText(/default branch/i) as HTMLSelectElement).value).toBe('main');
  });

  it('keeps Save Defaults disabled until edited, then PATCHes', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      '/api/v1/settings': savedSettings,
      'PATCH /api/v1/settings/github': savedSettings,
      'GET /api/v1/github/repositories/alice/api/branches': {
        success: true,
        branches: [{ name: 'main' }, { name: 'dev' }],
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderGH();

    const save = await screen.findByRole('button', { name: /save defaults/i });
    expect(save).toBeDisabled();

    // The branch list loads asynchronously for the default repository — wait
    // for it before selecting, otherwise the option may not exist yet.
    const branchSelect = screen.getByLabelText(/default branch/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(Array.from(branchSelect.options).some((o) => o.value === 'dev')).toBe(true);
    });

    await user.selectOptions(branchSelect, 'dev');
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse((patch![1] as RequestInit).body as string);
      expect(body.defaultRepository).toBe('alice/api');
      expect(body.defaultBranch).toBe('dev');
    });
  });

  it('Reconnect starts the OAuth flow returning to this settings tab', async () => {
    const user = userEvent.setup();
    connect.mockResolvedValue('https://github.com/login/oauth/authorize?x=1');
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/v1/settings': savedSettings,
        'GET /api/v1/github/repositories/alice/api/branches': {
          success: true,
          branches: [{ name: 'main' }],
        },
      }),
    );
    renderGH();

    const reconnect = await screen.findByRole('button', { name: /reconnect/i });
    await user.click(reconnect);

    await waitFor(() => {
      expect(connect).toHaveBeenCalledWith('/settings?tab=github');
    });
  });
});
