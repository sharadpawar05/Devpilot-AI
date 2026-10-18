import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

vi.mock('@/config', () => ({
  getEnv: () => ({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  }),
  loadEnv: () => ({}),
}));

import { jwtVerify } from 'jose';
import { authenticate } from '@/core/auth/middleware';

type FakeReply = {
  statusCode?: number;
  payload?: Record<string, unknown>;
  status(code: number): FakeReply;
  send(payload: unknown): FakeReply;
};

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

function makeRequest(authorization?: string): FastifyRequest {
  return {
    headers: authorization ? { authorization } : {},
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  } as unknown as FastifyRequest;
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a request without an Authorization header', async () => {
    const reply = makeReply();
    const result = await authenticate(makeRequest(), reply as unknown as FastifyReply);

    expect(result).toBeDefined();
    expect(reply.statusCode).toBe(401);
    expect(reply.payload?.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('verifies tokens with issuer, audience, and asymmetric algorithms only', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: 'user-1', aud: 'authenticated' },
      protectedHeader: {},
    } as never);
    const reply = makeReply();
    const request = makeRequest('Bearer valid-token');

    await authenticate(request, reply as unknown as FastifyReply);

    expect(jwtVerify).toHaveBeenCalledWith(
      'valid-token',
      expect.anything(),
      expect.objectContaining({
        algorithms: ['RS256', 'ES256'],
        issuer: 'https://example.supabase.co/auth/v1',
        audience: 'authenticated',
      }),
    );
    expect((request as FastifyRequest & { auth?: { sub?: string } }).auth?.sub).toBe('user-1');
    expect(reply.statusCode).toBeUndefined();
  });

  it('returns a generic message for invalid tokens without leaking JOSE details', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(
      new Error(
        'signature verification failed for key retrieved from https://example.supabase.co/auth/v1/.well-known/jwks.json',
      ),
    );
    const reply = makeReply();
    const request = makeRequest('Bearer forged-token');

    await authenticate(request, reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(401);
    const payload = JSON.stringify(reply.payload);
    expect(reply.payload?.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(payload).not.toContain('signature verification failed');
    expect(payload).not.toContain('jwks');
    expect(payload).not.toContain('forged-token');
  });

  it('handles expired tokens with a clear, non-internal message', async () => {
    const expiredError = Object.assign(new Error('exp claim timestamp check failed'), {
      code: 'ERR_JWT_EXPIRED',
    });
    vi.mocked(jwtVerify).mockRejectedValue(expiredError);
    const reply = makeReply();

    await authenticate(makeRequest('Bearer expired-token'), reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload?.error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Token has expired. Please sign in again.',
    });
    expect(JSON.stringify(reply.payload)).not.toContain('exp claim timestamp');
  });

  it('still rejects tokens that lack a subject', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { aud: 'authenticated' },
      protectedHeader: {},
    } as never);
    const reply = makeReply();

    await authenticate(makeRequest('Bearer no-sub'), reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload?.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
