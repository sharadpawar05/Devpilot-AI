import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { AIPreferencesSettings } from '@/components/settings/AIPreferencesSettings';

vi.mock('@/auth', () => ({
  useAuth: () => ({
    user: { id: 'supa-1', email: 'a@example.com', name: 'A', avatarUrl: null },
    session: { accessToken: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const savedAI = {
  defaultProvider: 'groq',
  defaultModel: 'qwen/qwen3.8-27b',
  temperature: 0.2,
  maxTokens: 8192,
  streamResponses: true,
  markdownOutput: true,
  autoScroll: true,
  autoCopy: false,
  defaultReviewType: 'deep',
  defaultReviewDepth: 'thorough',
};

const savedSettings = {
  success: true,
  profile: { name: 'A', email: 'a@example.com', avatarUrl: null, timezone: 'UTC' },
  ai: savedAI,
  github: {},
  appearance: {},
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

function renderAI() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AIPreferencesSettings />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AIPreferencesSettings', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the saved provider and model', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderAI();

    await waitFor(() => {
      expect(screen.getByLabelText(/default provider/i)).toBeInTheDocument();
    });

    expect((screen.getByLabelText(/default provider/i) as HTMLSelectElement).value).toBe('groq');
    expect((screen.getByLabelText(/default model/i) as HTMLSelectElement).value).toBe(
      'qwen/qwen3.8-27b',
    );
  });

  it('keeps Save disabled until edited, then PATCHes the AI prefs', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      '/api/v1/settings': savedSettings,
      'PATCH /api/v1/settings/ai': savedSettings,
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAI();

    const save = await screen.findByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    // Change the review type to make the form dirty.
    await user.click(screen.getByRole('button', { name: /^quick$/i }));

    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      const body = JSON.parse((patch![1] as RequestInit).body as string);
      expect(body.defaultReviewType).toBe('quick');
      expect(body.defaultProvider).toBe('groq');
    });
  });

  it('switching provider resets the model to that provider first model', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', mockFetch({ '/api/v1/settings': savedSettings }));
    renderAI();

    await waitFor(() => {
      expect(screen.getByLabelText(/default provider/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/default provider/i), 'openai');
    await waitFor(() => {
      expect((screen.getByLabelText(/default model/i) as HTMLSelectElement).value).toBe('gpt-4o');
    });
  });
});
