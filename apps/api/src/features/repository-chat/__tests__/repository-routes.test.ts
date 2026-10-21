import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const getStatus = vi.fn();
const getCommitSha = vi.fn();
const getIndex = vi.fn();
const ensureRepositoryAccess = vi.fn();
const index = vi.fn();
const claimIndexing = vi.fn();
const markFailed = vi.fn();

vi.mock('@/features/repository-chat/status', () => ({
  repositoryStatusService: {
    getStatus: (...args: unknown[]) => getStatus(...args),
    claimIndexing: (...args: unknown[]) => claimIndexing(...args),
    markIndexing: vi.fn(),
    markOutdated: vi.fn(),
    markFailed: (...args: unknown[]) => markFailed(...args),
  },
}));

vi.mock('@/features/repository-chat/cache', () => ({
  repositoryCache: {
    getCommitSha: (...args: unknown[]) => getCommitSha(...args),
  },
}));

vi.mock('@/features/repository-chat/indexer', () => ({
  repositoryIndexer: {
    getIndex: (...args: unknown[]) => getIndex(...args),
    index: (...args: unknown[]) => index(...args),
  },
}));

vi.mock('@/core/usage', () => ({
  usageService: {
    ensureRepositoryAccess: (...args: unknown[]) => ensureRepositoryAccess(...args),
  },
  sendUsageLimitReached: vi.fn(),
}));

import repositoryRoutes from '@/features/repository-chat/repository-routes';

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

function makeRequest(options: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}): FastifyRequest {
  return {
    auth: { sub: 'user-a' },
    params: options.params ?? {},
    query: options.query ?? {},
    body: options.body ?? {},
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyRequest;
}

async function loadHandlers(): Promise<Record<string, Handler>> {
  const handlers: Record<string, Handler> = {};
  const app = {
    get: (path: string, _opts: unknown, handler: Handler) => {
      handlers[`GET ${path}`] = handler;
    },
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[`POST ${path}`] = handler;
    },
    log: { error: vi.fn() },
  } as unknown as FastifyInstance;
  await repositoryRoutes(app);
  return handlers;
}

describe('repository routes input validation', () => {
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    handlers = await loadHandlers();
    getStatus.mockReset().mockResolvedValue('READY');
    getCommitSha.mockReset().mockResolvedValue('sha');
    getIndex.mockReset().mockResolvedValue(null);
    ensureRepositoryAccess.mockReset().mockResolvedValue({ allowed: true });
    index.mockReset().mockResolvedValue(undefined);
    claimIndexing.mockReset().mockResolvedValue(true);
    markFailed.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects path-segment injection in owner params before touching services', async () => {
    const reply = makeReply();
    await handlers['GET /repositories/:owner/:repo/index-status'](
      makeRequest({ params: { owner: 'evil/../other', repo: 'api' } }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(reply.payload?.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(getStatus).not.toHaveBeenCalled();
    expect(getCommitSha).not.toHaveBeenCalled();
  });

  it('rejects owner values containing a slash', async () => {
    const reply = makeReply();
    await handlers['GET /repositories/:owner/:repo/index-status'](
      makeRequest({ params: { owner: 'octo/../../users/other', repo: 'api' } }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('rejects repo values with invalid characters', async () => {
    const reply = makeReply();
    await handlers['POST /repositories/:owner/:repo/index'](
      makeRequest({ params: { owner: 'octo', repo: 'api?token=x' }, body: {} }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(getStatus).not.toHaveBeenCalled();
    expect(ensureRepositoryAccess).not.toHaveBeenCalled();
    expect(index).not.toHaveBeenCalled();
  });

  it('rejects branch values that enable traversal', async () => {
    const reply = makeReply();
    await handlers['GET /repositories/:owner/:repo/index-status'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, query: { branch: '../../etc' } }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('requires a path query parameter on file-content', async () => {
    const reply = makeReply();
    await handlers['GET /repositories/:owner/:repo/file-content'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, query: {} }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(reply.payload?.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(getIndex).not.toHaveBeenCalled();
  });

  it('rejects absolute and traversal file paths', async () => {
    const reply = makeReply();
    await handlers['GET /repositories/:owner/:repo/file-content'](
      makeRequest({
        params: { owner: 'octo', repo: 'api' },
        query: { path: '../../.env' },
      }),
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(getIndex).not.toHaveBeenCalled();
  });

  it('allows a valid request through to the ownership-scoped services', async () => {
    const reply = makeReply();
    const result = (await handlers['GET /repositories/:owner/:repo/index-status'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, query: { branch: 'main' } }),
      reply,
    )) as Record<string, unknown>;

    expect(getStatus).toHaveBeenCalledWith('user-a', 'octo', 'api', 'main');
    expect(getCommitSha).toHaveBeenCalledWith('user-a', 'octo', 'api', 'main');
    expect(result).toMatchObject({
      success: true,
      status: 'READY',
      commitSha: 'sha',
      branch: 'main',
    });
  });
});

describe('repository index claims', () => {
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    handlers = await loadHandlers();
    getStatus.mockReset().mockResolvedValue('READY');
    getIndex.mockReset().mockResolvedValue(null);
    ensureRepositoryAccess.mockReset().mockResolvedValue({ allowed: true });
    index.mockReset().mockResolvedValue(undefined);
    claimIndexing.mockReset().mockResolvedValue(true);
    markFailed.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts indexing through the atomic claim and returns immediately', async () => {
    const reply = makeReply();
    const result = (await handlers['POST /repositories/:owner/:repo/index'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, body: {} }),
      reply,
    )) as Record<string, unknown>;

    expect(claimIndexing).toHaveBeenCalledWith('user-a', 'octo', 'api', 'main');
    expect(result).toMatchObject({ success: true, status: 'INDEXING' });
  });

  it('rejects a second index request while a claim is held', async () => {
    claimIndexing.mockResolvedValue(false);

    const reply = makeReply();
    await handlers['POST /repositories/:owner/:repo/index'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, body: {} }),
      reply,
    );

    expect(reply.statusCode).toBe(409);
    expect(reply.payload?.error).toMatchObject({ code: 'INDEXING_IN_PROGRESS' });
    expect(index).not.toHaveBeenCalled();
  });

  it('claims before reindexing too', async () => {
    claimIndexing.mockResolvedValue(false);

    const reply = makeReply();
    await handlers['POST /repositories/:owner/:repo/reindex'](
      makeRequest({ params: { owner: 'octo', repo: 'api' }, body: {} }),
      reply,
    );

    expect(claimIndexing).toHaveBeenCalledWith('user-a', 'octo', 'api', 'main');
    expect(reply.statusCode).toBe(409);
  });
});
