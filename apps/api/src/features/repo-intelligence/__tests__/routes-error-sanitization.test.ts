import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const getMetadata = vi.fn();

vi.mock('@/features/repo-intelligence/repository-service', () => ({
  repositoryIntelligenceService: {
    getMetadata: (...args: unknown[]) => getMetadata(...args),
  },
}));

vi.mock('@/features/repo-intelligence/health-metering', () => ({
  getMeteredHealth: vi.fn(),
}));

vi.mock('@/core/usage', () => ({
  UsageLimitExceededError: class UsageLimitExceededError extends Error {},
  sendUsageLimitReached: vi.fn(),
}));

vi.mock('@/config', () => ({
  getEnv: () => ({ SUPABASE_URL: 'https://example.supabase.co' }),
  loadEnv: () => ({}),
}));

import { repoIntelligenceRoutes } from '@/features/repo-intelligence/routes';

type Handler = (request: unknown, reply: FakeReply) => Promise<unknown>;

interface FakeReply {
  statusCode?: number;
  payload?: Record<string, unknown>;
  status(code: number): FakeReply;
  send(payload: unknown): FakeReply;
}

function makeReply(): FakeReply {
  const reply: FakeReply = {
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply.payload = payload as Record<string, unknown>;
      return reply;
    },
  };
  return reply;
}

function makeRequest(query: Record<string, string>): FastifyRequest {
  return {
    auth: { sub: 'user-a' },
    query,
    params: {},
    body: {},
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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
    log: { error: vi.fn() },
  } as unknown as FastifyInstance;
  await repoIntelligenceRoutes(app);
  return handlers;
}

describe('repo-intelligence error responses are sanitized', () => {
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    handlers = await loadHandlers();
    getMetadata.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps GitHub auth failures without echoing raw upstream messages or tokens', async () => {
    getMetadata.mockRejectedValue(
      Object.assign(new Error('Bad credentials - ghp_leakedtoken999'), { status: 401 }),
    );
    const reply = makeReply();

    await handlers['/repo-intelligence/metadata'](
      makeRequest({ owner: 'octo', repo: 'api' }),
      reply,
    );

    expect(reply.statusCode).toBe(401);
    const payload = JSON.stringify(reply.payload);
    expect(payload).not.toContain('ghp_leakedtoken999');
    expect(payload).not.toContain('Bad credentials');
    expect(reply.payload?.error).toMatchObject({
      code: 'GITHUB_AUTH_FAILED',
      message: 'GitHub authentication failed. Please log in again.',
    });
  });

  it('hides internal connection details for unknown upstream errors', async () => {
    getMetadata.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.9:5432 with pg password db-secret'),
    );
    const reply = makeReply();

    await handlers['/repo-intelligence/metadata'](
      makeRequest({ owner: 'octo', repo: 'api' }),
      reply,
    );

    const payload = JSON.stringify(reply.payload);
    expect(payload).not.toContain('db-secret');
    expect(payload).not.toContain('ECONNREFUSED');
    expect(payload).not.toContain('10.0.0.9');
  });

  it('rejects invalid owner params with a validation error before calling services', async () => {
    const reply = makeReply();

    await handlers['/repo-intelligence/metadata'](
      makeRequest({ owner: 'octo/../../etc', repo: 'api' }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(getMetadata).not.toHaveBeenCalled();
  });
});
