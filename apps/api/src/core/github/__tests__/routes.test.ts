import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const env = {
  NODE_ENV: 'production' as const,
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
  GITHUB_REDIRECT_URI: 'https://app.example.com/github',
};

vi.mock('@/config', () => ({
  getEnv: () => env,
  loadEnv: () => env,
}));

vi.mock('@/core/db', () => ({
  db: { user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));

vi.mock('@/core/github/token', () => ({
  setGitHubToken: vi.fn(),
  getGitHubToken: vi.fn(),
  deleteGitHubToken: vi.fn(),
  getOctokit: vi.fn(),
  revokeGitHubToken: vi.fn(),
}));

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({
          data: { id: 42, login: 'octo-user', avatar_url: 'https://a', name: 'Octo' },
        }),
      },
    },
  })),
}));

import { githubRoutes } from '@/core/github/routes';
import { setGitHubToken, getOctokit } from '@/core/github/token';

type Handler = (request: unknown, reply: FakeReply) => Promise<unknown>;

interface FakeReply {
  statusCode?: number;
  payload?: Record<string, unknown>;
  clearedCookies: string[];
  setCookieCalls: Array<{ name: string; value: string }>;
  clearCookie: (name: string, opts?: unknown) => void;
  status(code: number): FakeReply;
  send(payload: unknown): FakeReply;
}

function makeReply(): FakeReply {
  const reply: FakeReply = {
    clearedCookies: [],
    setCookieCalls: [],
    setCookie(name: string, value: string) {
      reply.setCookieCalls.push({ name, value });
      return reply;
    },
    clearCookie(name: string) {
      reply.clearedCookies.push(name);
      return reply;
    },
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply.payload = payload as Record<string, unknown>;
      return reply;
    },
  } as FakeReply;
  return reply;
}

function signCookie(value: string): string {
  return `s:${value}.signature`;
}

function makeRequest(options: {
  sub?: string;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
}): FastifyRequest {
  const cookies = options.cookies ?? {};
  return {
    auth: { sub: options.sub ?? 'user-a', email: 'a@example.com', user_metadata: {} },
    query: options.query ?? {},
    cookies,
    unsignCookie: (raw: string) => ({
      valid: true,
      renew: false,
      value: raw.startsWith('s:') ? raw.slice(2).split('.')[0] : raw,
    }),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  } as unknown as FastifyRequest;
}

async function loadHandlers(): Promise<Record<string, Handler>> {
  const handlers: Record<string, Handler> = {};
  const app = {
    get: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    delete: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance;
  await githubRoutes(app);
  return handlers;
}

describe('GET /github/callback OAuth hardening', () => {
  let handlers: Record<string, Handler>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    handlers = await loadHandlers();
    vi.mocked(setGitHubToken).mockReset();
    fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ access_token: 'gho_exchanged_token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const callback = '/github/callback';

  it('completes the flow when state and the user-binding cookie match the session', async () => {
    const reply = makeReply();
    const state = 'state-123';

    await handlers[callback](
      makeRequest({
        sub: 'user-a',
        query: { code: 'auth-code', state },
        cookies: {
          github_oauth_state: signCookie(state),
          github_oauth_user: signCookie('user-a'),
        },
      }),
      reply,
    );

    expect(reply.statusCode).toBeUndefined();
    expect(reply.payload?.success).toBe(true);
    expect(setGitHubToken).toHaveBeenCalledWith(
      'user-a',
      'gho_exchanged_token',
      'a@example.com',
      undefined,
      expect.objectContaining({ login: 'octo-user' }),
    );
    expect(reply.clearedCookies).toEqual(['github_oauth_state', 'github_oauth_user']);
  });

  it('rejects a callback whose user cookie belongs to a different user (cross-account binding)', async () => {
    const reply = makeReply();
    const state = 'state-123';

    await handlers[callback](
      makeRequest({
        sub: 'user-b',
        query: { code: 'auth-code', state },
        cookies: {
          github_oauth_state: signCookie(state),
          github_oauth_user: signCookie('user-a'),
        },
      }),
      reply,
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload?.error).toMatchObject({ code: 'INVALID_STATE' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setGitHubToken).not.toHaveBeenCalled();
  });

  it('rejects a callback with a missing user-binding cookie', async () => {
    const reply = makeReply();
    const state = 'state-123';

    await handlers[callback](
      makeRequest({
        sub: 'user-a',
        query: { code: 'auth-code', state },
        cookies: { github_oauth_state: signCookie(state) },
      }),
      reply,
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload?.error).toMatchObject({ code: 'INVALID_STATE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a mismatched OAuth state (CSRF)', async () => {
    const reply = makeReply();

    await handlers[callback](
      makeRequest({
        sub: 'user-a',
        query: { code: 'auth-code', state: 'attacker-state' },
        cookies: {
          github_oauth_state: signCookie('victim-state'),
          github_oauth_user: signCookie('user-a'),
        },
      }),
      reply,
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload?.error).toMatchObject({ code: 'INVALID_STATE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a callback when the state cookie is missing entirely', async () => {
    const reply = makeReply();

    await handlers[callback](
      makeRequest({
        sub: 'user-a',
        query: { code: 'auth-code', state: 'any-state' },
        cookies: { github_oauth_user: signCookie('user-a') },
      }),
      reply,
    );

    expect(reply.statusCode).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /github/auth-url production callback configuration', () => {
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    handlers = await loadHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses to start OAuth when GITHUB_REDIRECT_URI points at localhost in production', async () => {
    const previous = env.GITHUB_REDIRECT_URI;
    (env as { GITHUB_REDIRECT_URI: string }).GITHUB_REDIRECT_URI = 'http://localhost:3000/github';

    try {
      const reply = makeReply();
      await handlers['/github/auth-url'](makeRequest({ sub: 'user-a' }), reply);

      expect(reply.statusCode).toBe(500);
      expect(reply.payload?.error).toMatchObject({ code: 'CONFIGURATION_ERROR' });
      expect(reply.setCookieCalls).toEqual([]);
    } finally {
      (env as { GITHUB_REDIRECT_URI: string }).GITHUB_REDIRECT_URI = previous;
    }
  });

  it('starts OAuth with a production https redirect URI', async () => {
    const reply = makeReply();
    await handlers['/github/auth-url'](makeRequest({ sub: 'user-a' }), reply);

    expect(reply.statusCode).toBeUndefined();
    expect(reply.payload?.success).toBe(true);
    const url = (reply.payload as { url: string }).url;
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fgithub');
    expect(reply.setCookieCalls.map((c) => c.name)).toEqual([
      'github_oauth_state',
      'github_oauth_user',
    ]);
  });
});

describe('GitHub route error responses are sanitized', () => {
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    handlers = await loadHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not echo raw upstream error messages from /github/repositories', async () => {
    vi.mocked(getOctokit).mockRejectedValue(
      new Error('socket hang up while requesting https://api.github.com with token ghp_secret123'),
    );

    const reply = makeReply();
    await handlers['/github/repositories'](makeRequest({ sub: 'user-a' }), reply);

    expect(reply.statusCode).toBeGreaterThanOrEqual(400);
    const payload = JSON.stringify(reply.payload);
    expect(payload).not.toContain('ghp_secret123');
    expect(payload).not.toContain('socket hang up');
    expect(reply.payload?.error).toMatchObject({ code: expect.any(String) });
  });
});
