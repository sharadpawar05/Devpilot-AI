import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { aiHistoryRoutes } from '@/features/ai-history/routes';
import { usageService, type QuotaCheckResult } from '@/core/usage';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    aIHistorySession: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

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

async function createSessionHandler(): Promise<Handler> {
  const handlers: Record<string, Handler> = {};
  const app = {
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    get: () => undefined,
    put: () => undefined,
    patch: () => undefined,
    delete: () => undefined,
  } as unknown as FastifyInstance;
  await aiHistoryRoutes(app);
  return handlers['/ai-history/sessions'];
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

const allowed: QuotaCheckResult = {
  allowed: true,
  used: 1,
  limit: 1,
  remaining: 0,
  resetAt: new Date('2026-10-01T00:00:00.000Z'),
};

const validBody = {
  workflowType: 'repository-chat',
  repository: 'octo/api',
  title: 'Session',
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  messages: [{ role: 'user', content: 'hi' }],
};

describe('POST /ai-history/sessions repository quota gate', () => {
  let handler: Handler;
  let ensureSpy: MockInstance<typeof usageService.ensureRepositoryAccess>;
  let findUnique: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    handler = await createSessionHandler();
    ensureSpy = vi.spyOn(usageService, 'ensureRepositoryAccess');
    findUnique = db.user.findUnique as ReturnType<typeof vi.fn>;
    create = db.aIHistorySession.create as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValue({ id: 'local-user' });
    create.mockResolvedValue({
      id: 'session-1',
      workflowType: 'REPOSITORY_CHAT',
      repository: 'octo/api',
      title: 'Session',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      totalLatency: 0,
      totalTokens: 0,
      pinned: false,
      archived: false,
      favorite: false,
      createdAt: new Date('2026-09-27T00:00:00.000Z'),
      updatedAt: new Date('2026-09-27T00:00:00.000Z'),
      messages: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a session that would exceed the repository limit', async () => {
    ensureSpy.mockResolvedValue(limitReached(1, 1));
    const reply = makeReply();

    await handler({ auth: { sub: 'supa-user' }, body: validBody }, reply);

    expect(ensureSpy).toHaveBeenCalledWith('supa-user', 'octo', 'api');
    expect(reply.statusCode).toBe(403);
    expect(reply.payload?.error).toMatchObject({
      code: 'USAGE_LIMIT_REACHED',
      feature: 'REPOSITORIES',
      used: 1,
      limit: 1,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('saves the session when the repository is already activated', async () => {
    ensureSpy.mockResolvedValue(allowed);
    const reply = makeReply();

    await handler({ auth: { sub: 'supa-user' }, body: validBody }, reply);

    expect(ensureSpy).toHaveBeenCalledWith('supa-user', 'octo', 'api');
    expect(reply.statusCode).toBeUndefined();
    expect(reply.payload?.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('skips the gate for sessions without a repository scope', async () => {
    ensureSpy.mockResolvedValue(allowed);
    const reply = makeReply();

    await handler(
      {
        auth: { sub: 'supa-user' },
        body: { ...validBody, workflowType: 'playground', repository: undefined },
      },
      reply,
    );

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('skips the gate for repository values the counter never counts', async () => {
    ensureSpy.mockResolvedValue(allowed);
    const reply = makeReply();

    await handler(
      { auth: { sub: 'supa-user' }, body: { ...validBody, repository: 'no-separator' } },
      reply,
    );

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('POST /ai-history/sessions idempotency (clientRequestId)', () => {
  let handler: Handler;
  let findUser: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let sessionFindUnique: ReturnType<typeof vi.fn>;

  const existingSession = {
    id: 'session-existing',
    workflowType: 'PLAYGROUND',
    repository: null,
    title: 'Prompt',
    provider: 'gemini',
    model: 'gemini-3.6-flash',
    totalLatency: 0,
    totalTokens: 0,
    pinned: false,
    archived: false,
    favorite: false,
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    updatedAt: new Date('2026-10-20T00:00:00.000Z'),
    messages: [],
  };

  const bodyWithKey = {
    workflowType: 'playground',
    title: 'Prompt',
    provider: 'gemini',
    model: 'gemini-3.6-flash',
    messages: [{ role: 'user', content: 'hi' }],
    clientRequestId: 'client-req-0001',
  };

  beforeEach(async () => {
    handler = await createSessionHandler();
    vi.spyOn(usageService, 'ensureRepositoryAccess').mockResolvedValue(allowed);
    findUser = db.user.findUnique as ReturnType<typeof vi.fn>;
    create = db.aIHistorySession.create as ReturnType<typeof vi.fn>;
    sessionFindUnique = db.aIHistorySession.findUnique as ReturnType<typeof vi.fn>;
    findUser.mockResolvedValue({ id: 'local-user' });
    create.mockResolvedValue({ ...existingSession, id: 'session-1' });
    sessionFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the existing session instead of creating a duplicate row', async () => {
    sessionFindUnique.mockResolvedValue(existingSession);
    const reply = makeReply();

    await handler({ auth: { sub: 'supa-user' }, body: bodyWithKey }, reply);

    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: {
        userId_clientRequestId: {
          userId: 'local-user',
          clientRequestId: 'client-req-0001',
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    expect(create).not.toHaveBeenCalled();
    expect(reply.payload?.success).toBe(true);
    expect(reply.payload?.id).toBe('session-existing');
  });

  it('creates the session when the key is new', async () => {
    const reply = makeReply();

    await handler({ auth: { sub: 'supa-user' }, body: bodyWithKey }, reply);

    expect(create).toHaveBeenCalledTimes(1);
    const createArgs = create.mock.calls[0][0] as { data: { clientRequestId?: string } };
    expect(createArgs.data.clientRequestId).toBe('client-req-0001');
    expect(reply.payload?.id).toBe('session-1');
  });

  it('maps a concurrent unique violation (P2002) to the winning session', async () => {
    create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    sessionFindUnique.mockResolvedValueOnce(null).mockResolvedValue(existingSession);
    const reply = makeReply();

    await handler({ auth: { sub: 'supa-user' }, body: bodyWithKey }, reply);

    expect(create).toHaveBeenCalledTimes(1);
    expect(reply.payload?.success).toBe(true);
    expect(reply.payload?.id).toBe('session-existing');
  });

  it('does not create two rows for two identical requests', async () => {
    // First request: key not yet present.
    sessionFindUnique.mockResolvedValueOnce(null);
    const reply1 = makeReply();
    await handler({ auth: { sub: 'supa-user' }, body: bodyWithKey }, reply1);

    // Second request (retry/double-fire): key now present.
    sessionFindUnique.mockResolvedValueOnce(existingSession);
    const reply2 = makeReply();
    await handler({ auth: { sub: 'supa-user' }, body: bodyWithKey }, reply2);

    expect(create).toHaveBeenCalledTimes(1);
    expect(reply1.payload?.id).toBe('session-1');
    expect(reply2.payload?.id).toBe('session-existing');
  });
});
