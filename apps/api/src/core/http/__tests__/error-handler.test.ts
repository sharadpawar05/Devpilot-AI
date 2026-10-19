import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from '@/plugins/error-handler';
import { registerRequestLogger } from '@/core/logging/request-logger';
import { buildServerOptions } from '@/core/http/server-options';

/**
 * Integration tests for the request-ID / error-envelope contract, using a
 * real Fastify instance (not stubs) so hooks, serialization and genReqId
 * interact the same way they do in production.
 */
async function buildApp(): Promise<FastifyInstance> {
  const options = buildServerOptions({ NODE_ENV: 'test', LOG_LEVEL: 'error' });
  const app = Fastify({ ...options, logger: false });
  await registerErrorHandler(app);
  await registerRequestLogger(app);

  app.get('/ok', async () => ({ success: true }));
  app.get('/boom', async () => {
    throw new Error('db exploded with password db-secret-12345');
  });
  app.post(
    '/echo',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
    async (request) => ({ success: true, body: request.body }),
  );
  app.get('/legacy-error', async (_request, reply) =>
    reply.status(400).send({ success: false, error: { message: 'bad input' } }),
  );
  app.get('/limited', async () => {
    const err = new Error('Too many requests. Please try again in 1 minute.') as Error & {
      statusCode?: number;
      code?: string;
      expose?: boolean;
    };
    err.statusCode = 429;
    err.code = 'RATE_LIMIT_EXCEEDED';
    err.expose = true;
    throw err;
  });

  await app.ready();
  return app;
}

describe('request IDs', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('generates a UUID when no x-request-id is supplied and echoes it', async () => {
    const response = await app.inject({ method: 'GET', url: '/ok' });

    expect(response.statusCode).toBe(200);
    const echoed = response.headers['x-request-id'];
    expect(typeof echoed).toBe('string');
    expect(echoed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('trusts a well-formed inbound x-request-id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ok',
      headers: { 'x-request-id': 'trace-abc.123' },
    });

    expect(response.headers['x-request-id']).toBe('trace-abc.123');
  });

  it('replaces a log-injection attempt with a generated UUID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ok',
      headers: { 'x-request-id': 'evil\ninjected' },
    });

    const echoed = String(response.headers['x-request-id']);
    expect(echoed).not.toContain('\n');
    expect(echoed).not.toContain('evil');
    expect(echoed).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replaces an oversized inbound ID with a generated UUID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ok',
      headers: { 'x-request-id': 'a'.repeat(300) },
    });

    expect(response.headers['x-request-id']).not.toBe('a'.repeat(300));
    expect(String(response.headers['x-request-id']).length).toBeLessThanOrEqual(128);
  });
});

describe('error envelope', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns sanitized errors with the request ID for unhandled failures', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'req-err-1' },
    });

    expect(response.statusCode).toBe(500);
    const body = response.json() as { success: boolean; error: Record<string, string> };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.requestId).toBe('req-err-1');
    // The raw failure (and its embedded secret) must not reach the client.
    expect(response.body).not.toContain('db-secret-12345');
    expect(body.error.message).toBe('An unexpected error occurred.');
  });

  it('normalizes route error bodies that lack a code via preSerialization', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/legacy-error',
      headers: { 'x-request-id': 'req-legacy-1' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { success: boolean; error: Record<string, string> };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('bad input');
    expect(body.error.requestId).toBe('req-legacy-1');
  });

  it('maps schema validation failures to VALIDATION_ERROR', async () => {
    const response = await app.inject({ method: 'POST', url: '/echo', payload: {} });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { success: boolean; error: Record<string, string> };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof body.error.requestId).toBe('string');
  });

  it('returns NOT_FOUND with the standard envelope for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    const body = response.json() as { success: boolean; error: Record<string, string> };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found');
    expect(typeof body.error.requestId).toBe('string');
  });

  it('keeps expose:true errors verbatim (rate limiter contract)', async () => {
    const response = await app.inject({ method: 'GET', url: '/limited' });

    expect(response.statusCode).toBe(429);
    const body = response.json() as { error: Record<string, string> };
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toBe('Too many requests. Please try again in 1 minute.');
  });

  it('does not attach requestId to successful payloads', async () => {
    const response = await app.inject({ method: 'GET', url: '/ok' });
    const body = response.json() as Record<string, unknown>;
    expect(body).toEqual({ success: true });
  });
});

describe('errorCodeForStatus', () => {
  it('maps common statuses and falls back sensibly', async () => {
    const { errorCodeForStatus } = await import('@/plugins/error-handler');
    expect(errorCodeForStatus(404)).toBe('NOT_FOUND');
    expect(errorCodeForStatus(429)).toBe('RATE_LIMIT_EXCEEDED');
    expect(errorCodeForStatus(418)).toBe('REQUEST_ERROR');
    expect(errorCodeForStatus(599)).toBe('INTERNAL_ERROR');
  });
});
