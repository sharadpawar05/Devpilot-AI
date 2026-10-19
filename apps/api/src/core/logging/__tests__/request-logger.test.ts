import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { redactUrl, registerRequestLogger } from '@/core/logging/request-logger';

describe('redactUrl', () => {
  it('redacts the GitHub OAuth authorization code and state', () => {
    const url = '/api/v1/github/callback?code=abc123secret&state=st-456';
    const redacted = redactUrl(url);

    expect(redacted).toBe('/api/v1/github/callback?code=[redacted]&state=[redacted]');
    expect(redacted).not.toContain('abc123secret');
    expect(redacted).not.toContain('st-456');
  });

  it('redacts token-like and secret query parameters', () => {
    const redacted = redactUrl(
      '/x?access_token=ghp_x&refresh_token=r&api_key=k&password=p&secret=s',
    );

    expect(redacted).toBe(
      '/x?access_token=[redacted]&refresh_token=[redacted]&api_key=[redacted]&password=[redacted]&secret=[redacted]',
    );
  });

  it('preserves non-sensitive query parameters for observability', () => {
    const redacted = redactUrl(
      '/api/v1/repositories/octo/api/structure?branch=feature%2Ffoo&code=leak',
    );

    expect(redacted).toContain('branch=feature%2Ffoo');
    expect(redacted).toContain('code=[redacted]');
    expect(redacted).not.toContain('leak');
  });

  it('leaves URLs without query strings untouched', () => {
    expect(redactUrl('/api/v1/health')).toBe('/api/v1/health');
  });
});

describe('registerRequestLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs redacted URLs from the onResponse hook and echoes the request ID', async () => {
    const hooks: Record<string, (req: unknown, reply: unknown, done: () => void) => void> = {};
    const app = {
      addHook: (name: string, fn: (req: unknown, reply: unknown, done: () => void) => void) => {
        hooks[name] = fn;
      },
    } as unknown as FastifyInstance;

    await registerRequestLogger(app);

    const logInfo = vi.fn();
    const request = {
      id: 'req-test-1',
      method: 'GET',
      url: '/api/v1/github/callback?code=topsecretcode&state=topsecretstate',
      log: { info: logInfo },
      routeOptions: { url: '/api/v1/github/callback' },
    } as unknown as FastifyRequest;
    const header = vi.fn();
    const reply = { statusCode: 200, header } as unknown as FastifyReply;

    hooks.onRequest(request, reply, () => {});
    hooks.onResponse(request, reply, () => {});

    // onRequest echoes the correlation ID so clients can join responses to logs.
    expect(header).toHaveBeenCalledWith('x-request-id', 'req-test-1');

    expect(logInfo).toHaveBeenCalledTimes(1);
    const logged = logInfo.mock.calls[0][0] as {
      url: string;
      method: string;
      statusCode: number;
      route: string;
    };
    expect(logged.url).toContain('code=[redacted]');
    expect(logged.url).toContain('state=[redacted]');
    expect(logged.url).not.toContain('topsecretcode');
    expect(logged.url).not.toContain('topsecretstate');
    expect(logged.method).toBe('GET');
    expect(logged.statusCode).toBe(200);
    expect(logged.route).toBe('/api/v1/github/callback');
  });
});
