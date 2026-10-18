import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { streamingRoutes } from '@/features/streaming/routes';
import { usageService, type ConsumeResult, type QuotaCheckResult } from '@/core/usage';

vi.mock('@/core/ai/service', () => ({
  aiService: { getAvailableProviders: () => ['gemini'] },
}));

vi.mock('@/config', () => ({
  getEnv: () => ({ CORS_ORIGIN: '*' }),
  loadEnv: () => ({}),
  PACKAGE_VERSION: '0.0.0',
}));

vi.mock('@/core/ai/workflow/engine', () => ({
  workflowEngine: {
    executeStream: () =>
      (async function* () {
        // Yield asynchronously so tests can simulate a mid-stream disconnect.
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield { type: 'error', provider: 'gemini', error: { message: 'provider error' } };
      })(),
  },
}));

type Handler = (request: unknown, reply: FakeReply) => Promise<unknown>;

interface FakeReply {
  statusCode?: number;
  payload?: Record<string, unknown>;
  ended: boolean;
  status(code: number): FakeReply;
  send(payload: unknown): FakeReply;
  raw: {
    writeHead: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function makeReply(): FakeReply {
  const reply: FakeReply = {
    ended: false,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply.payload = payload as Record<string, unknown>;
      return reply;
    },
    raw: {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(() => {
        reply.ended = true;
      }),
    },
  };
  return reply;
}

async function streamHandler(): Promise<Handler> {
  const handlers: Record<string, Handler> = {};
  const app = {
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
  } as unknown as FastifyInstance;
  await streamingRoutes(app);
  return handlers['/stream'];
}

function limitReached(used: number, limit: number): QuotaCheckResult {
  const resetAt = new Date('2026-10-01T00:00:00.000Z');
  return {
    allowed: false,
    used,
    limit,
    remaining: 0,
    resetAt,
    details: { feature: 'REPOSITORIES', used, limit, resetAt },
  };
}

function allowedCheck(): QuotaCheckResult {
  return {
    allowed: true,
    used: 1,
    limit: 1,
    remaining: 0,
    resetAt: new Date('2026-10-01T00:00:00.000Z'),
  };
}

function consumeOk(): ConsumeResult {
  return { ...allowedCheck(), consumed: true };
}

describe('POST /stream repository quota gate', () => {
  let handler: Handler;
  let ensureSpy: MockInstance<typeof usageService.ensureRepositoryAccess>;
  let consumeCreditsSpy: MockInstance<typeof usageService.consumeWithCredits>;
  let consumeQuotaSpy: MockInstance<typeof usageService.consumeQuota>;

  beforeEach(async () => {
    handler = await streamHandler();
    ensureSpy = vi.spyOn(usageService, 'ensureRepositoryAccess');
    consumeCreditsSpy = vi.spyOn(usageService, 'consumeWithCredits');
    consumeQuotaSpy = vi.spyOn(usageService, 'consumeQuota');
    consumeCreditsSpy.mockResolvedValue(consumeOk());
    consumeQuotaSpy.mockResolvedValue(consumeOk());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function request(body: Record<string, unknown>) {
    return {
      auth: { sub: 'supa-user' },
      headers: {},
      body,
      raw: {
        on: vi.fn(),
        removeListener: vi.fn(),
      },
    };
  }

  it('rejects a repo-scoped workflow beyond the repository limit before spending credits', async () => {
    ensureSpy.mockResolvedValue(limitReached(1, 1));
    const reply = makeReply();

    await handler(
      request({ workflowType: 'REPOSITORY_CHAT', context: { owner: 'octo', repo: 'api' } }),
      reply,
    );

    expect(ensureSpy).toHaveBeenCalledWith('supa-user', 'octo', 'api');
    expect(reply.statusCode).toBe(403);
    expect(reply.payload?.error).toMatchObject({
      code: 'USAGE_LIMIT_REACHED',
      feature: 'REPOSITORIES',
      used: 1,
      limit: 1,
    });
    expect(consumeCreditsSpy).not.toHaveBeenCalled();
    expect(consumeQuotaSpy).not.toHaveBeenCalled();
    expect(reply.raw.writeHead).not.toHaveBeenCalled();
  });

  it('charges the workflow only after repository access is granted', async () => {
    ensureSpy.mockResolvedValue(allowedCheck());
    vi.spyOn(usageService, 'refundWithCredits').mockResolvedValue(undefined as never);
    const reply = makeReply();

    await handler(
      request({ workflowType: 'REPOSITORY_CHAT', context: { owner: 'octo', repo: 'api' } }),
      reply,
    );

    expect(ensureSpy).toHaveBeenCalledWith('supa-user', 'octo', 'api');
    expect(consumeCreditsSpy).toHaveBeenCalledWith('supa-user', 'CHAT_MESSAGE', 'REPOSITORY_CHAT');
    expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('never touches repository access for workflows without a repository scope', async () => {
    ensureSpy.mockResolvedValue(allowedCheck());
    vi.spyOn(usageService, 'refundWithCredits').mockResolvedValue(undefined as never);
    const reply = makeReply();

    await handler(request({ workflowType: 'PLAYGROUND', context: {} }), reply);

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(consumeCreditsSpy).toHaveBeenCalledWith('supa-user', 'CHAT_MESSAGE', 'SIMPLE_CHAT');
    expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('reads the repository scope from metadata when context carries none', async () => {
    ensureSpy.mockResolvedValue(limitReached(1, 1));
    const reply = makeReply();

    await handler(
      request({
        workflowType: 'DOCUMENTATION',
        context: {},
        metadata: { owner: 'octo', repo: 'api' },
      }),
      reply,
    );

    expect(ensureSpy).toHaveBeenCalledWith('supa-user', 'octo', 'api');
    expect(reply.statusCode).toBe(403);
    expect(consumeCreditsSpy).not.toHaveBeenCalled();
  });

  it('rejects a repo-scoped workflow without owner/repo before spending credits', async () => {
    ensureSpy.mockResolvedValue(allowedCheck());
    const reply = makeReply();

    await handler(request({ workflowType: 'REPOSITORY_CHAT', context: {} }), reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload?.error).toMatchObject({ code: 'MISSING_REPO_SCOPE' });
    expect(ensureSpy).not.toHaveBeenCalled();
    expect(consumeCreditsSpy).not.toHaveBeenCalled();
    expect(reply.raw.writeHead).not.toHaveBeenCalled();
  });

  it('aborts the stream and refunds credits when the client disconnects mid-stream', async () => {
    ensureSpy.mockResolvedValue(allowedCheck());
    const refundSpy = vi
      .spyOn(usageService, 'refundWithCredits')
      .mockResolvedValue(undefined as never);
    const reply = makeReply();
    const req = request({
      workflowType: 'REPOSITORY_CHAT',
      context: { owner: 'octo', repo: 'api' },
    });

    const handlerPromise = handler(req, reply);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const closeCall = req.raw.on.mock.calls.find(([event]) => event === 'close');
    expect(closeCall).toBeDefined();
    (closeCall as unknown as [string, () => void])[1]();
    await handlerPromise;

    expect(refundSpy).toHaveBeenCalledWith('supa-user', 'CHAT_MESSAGE', 'REPOSITORY_CHAT');
  });
});
