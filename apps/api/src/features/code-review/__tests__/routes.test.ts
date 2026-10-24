import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { codeReviewRoutes } from '@/features/code-review/routes';
import { aiService } from '@/core/ai/service';
import { usageService, type ConsumeResult } from '@/core/usage';
import { notifyIfEnabled } from '@/features/notifications/routes';

vi.mock('@/core/ai/service', () => ({
  aiService: {
    getAvailableProviders: () => ['gemini'],
    generate: vi.fn(),
  },
}));

vi.mock('@/config', () => ({
  getEnv: () => ({ CORS_ORIGIN: '*' }),
  loadEnv: () => ({}),
  PACKAGE_VERSION: '0.0.0',
}));

vi.mock('@/features/notifications/routes', () => ({
  notifyIfEnabled: vi.fn(),
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

async function codeReviewHandler(): Promise<Handler> {
  const handlers: Record<string, Handler> = {};
  const app = {
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    log: { error: vi.fn() },
  } as unknown as FastifyInstance;
  await codeReviewRoutes(app);
  return handlers['/code-review'];
}

function consumeOk(): ConsumeResult {
  const resetAt = new Date('2026-10-01T00:00:00.000Z');
  return {
    allowed: true,
    used: 1,
    limit: 100,
    remaining: 99,
    resetAt,
    consumed: true,
  };
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    auth: { sub: 'supa-user' },
    headers: {},
    body: {
      code: 'const x = 1',
      language: 'typescript',
      provider: 'gemini',
      ...overrides,
    },
  };
}

describe('POST /code-review error sanitization', () => {
  let handler: Handler;
  let generateMock: MockInstance<typeof aiService.generate>;

  beforeEach(async () => {
    handler = await codeReviewHandler();
    generateMock = vi.mocked(aiService.generate);
    vi.spyOn(usageService, 'consumeQuota').mockResolvedValue(consumeOk());
    vi.spyOn(usageService, 'refundQuota').mockResolvedValue(undefined as never);
    vi.spyOn(usageService, 'recordAIUsageEvent').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts provider secrets and never returns the raw provider error message', async () => {
    generateMock.mockRejectedValue(
      new Error('upstream exploded with secret key sk-abcDEF123456789'),
    );
    const reply = makeReply();

    await handler(requestBody(), reply);

    expect(reply.statusCode).toBeGreaterThanOrEqual(400);
    const payload = JSON.stringify(reply.payload);
    expect(payload).not.toContain('sk-abcDEF123456789');
    expect(payload).toContain('[redacted]');
    expect(usageService.refundQuota).toHaveBeenCalledWith(
      'supa-user',
      'AI_CREDITS',
      expect.any(Number),
    );
  });
});

describe('POST /code-review completion notification', () => {
  let handler: Handler;
  let generateMock: MockInstance<typeof aiService.generate>;

  beforeEach(async () => {
    handler = await codeReviewHandler();
    generateMock = vi.mocked(aiService.generate);
    vi.spyOn(usageService, 'consumeQuota').mockResolvedValue(consumeOk());
    vi.spyOn(usageService, 'refundQuota').mockResolvedValue(undefined as never);
    vi.spyOn(usageService, 'recordAIUsageEvent').mockResolvedValue(undefined as never);
    vi.mocked(notifyIfEnabled).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an in-app notification when a review completes', async () => {
    generateMock.mockResolvedValue({
      content: 'Looks good.',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      tokens: { input: 10, output: 20, total: 30 },
      latencyMs: 42,
      cost: { totalCost: 0.01 },
    } as never);

    const reply = makeReply();
    await handler(requestBody({ reviewType: 'Security', reviewDepth: 'Quick' }), reply);

    expect(reply.payload).toMatchObject({ success: true });
    expect(notifyIfEnabled).toHaveBeenCalledTimes(1);
    expect(notifyIfEnabled).toHaveBeenCalledWith(
      'supa-user',
      'review_complete',
      'Code review completed',
      expect.stringContaining('Security'),
    );
  });

  it('does not notify when the review fails', async () => {
    generateMock.mockRejectedValue(new Error('upstream exploded'));

    const reply = makeReply();
    await handler(requestBody(), reply);

    expect(reply.statusCode).toBeGreaterThanOrEqual(400);
    expect(notifyIfEnabled).not.toHaveBeenCalled();
  });
});
