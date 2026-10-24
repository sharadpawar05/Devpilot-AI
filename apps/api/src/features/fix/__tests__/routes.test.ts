import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { fixRoutes } from '@/features/fix/routes';
import { aiService } from '@/core/ai/service';
import { usageService, type ConsumeResult } from '@/core/usage';

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

async function fixHandler(): Promise<Handler> {
  const handlers: Record<string, Handler> = {};
  const app = {
    post: (path: string, _opts: unknown, handler: Handler) => {
      handlers[path] = handler;
    },
    log: { error: vi.fn() },
  } as unknown as FastifyInstance;
  await fixRoutes(app);
  return handlers['/ai/fix'];
}

function limitReached(): ConsumeResult {
  const resetAt = new Date('2026-10-01T00:00:00.000Z');
  return {
    allowed: false,
    used: 100,
    limit: 100,
    remaining: 0,
    resetAt,
    consumed: false,
    details: { feature: 'AI_CREDITS', used: 100, limit: 100, resetAt },
  };
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

describe('POST /ai/fix', () => {
  let handler: Handler;
  let consumeSpy: MockInstance<typeof usageService.consumeQuota>;
  let generateMock: MockInstance<typeof aiService.generate>;

  beforeEach(async () => {
    handler = await fixHandler();
    consumeSpy = vi.spyOn(usageService, 'consumeQuota');
    generateMock = vi.mocked(aiService.generate);
    consumeSpy.mockResolvedValue(consumeOk());
    vi.spyOn(usageService, 'refundQuota').mockResolvedValue(undefined as never);
    vi.spyOn(usageService, 'recordAIUsageEvent').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('charges CODE_FIX credits and records usage on success', async () => {
    generateMock.mockResolvedValue({
      content: 'fixed',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      latencyMs: 100,
      tokens: { input: 10, output: 20, total: 30 },
      cost: { totalCost: 0.001 },
    } as never);
    const reply = makeReply();

    await handler(requestBody(), reply);

    expect(consumeSpy).toHaveBeenCalledWith('supa-user', 'AI_CREDITS', 3);
    expect(usageService.recordAIUsageEvent).toHaveBeenCalled();
    expect(reply.payload).toMatchObject({ success: true, response: 'fixed' });
  });

  it('rejects a language that is not a short identifier without spending credits', async () => {
    const reply = makeReply();

    await handler(requestBody({ language: '<script>alert(1)</script>' }), reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload?.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('rejects an unavailable provider without spending credits', async () => {
    const reply = makeReply();

    await handler(requestBody({ provider: 'openai' }), reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload?.error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(consumeSpy).not.toHaveBeenCalled();
  });

  it('returns 402 when the credit quota is exhausted without calling the provider', async () => {
    consumeSpy.mockResolvedValue(limitReached());
    const reply = makeReply();

    await handler(requestBody(), reply);

    expect(reply.statusCode).toBe(402);
    expect(reply.payload?.error).toMatchObject({ code: 'USAGE_LIMIT_REACHED' });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('refunds credits and returns a sanitized error when the provider fails', async () => {
    const refundSpy = vi.mocked(usageService.refundQuota);
    generateMock.mockRejectedValue(
      new Error('upstream exploded with secret key sk-abcDEF123456789'),
    );
    const reply = makeReply();

    await handler(requestBody(), reply);

    expect(refundSpy).toHaveBeenCalledWith('supa-user', 'AI_CREDITS', 3);
    expect(reply.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(reply.payload)).not.toContain('sk-abcDEF123456789');
    expect(JSON.stringify(reply.payload)).toContain('[redacted]');
  });
});
