import { describe, it, expect } from 'vitest';
import { buildServerOptions, resolveRequestId } from '@/core/http/server-options';

describe('buildServerOptions', () => {
  it('trusts X-Forwarded-For in production so per-IP rate limiting works behind the proxy', () => {
    const options = buildServerOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });

    expect(options.trustProxy).toBe(true);
  });

  it('does not trust X-Forwarded-For outside production (anti spoofing)', () => {
    expect(buildServerOptions({ NODE_ENV: 'development', LOG_LEVEL: 'info' }).trustProxy).toBe(
      false,
    );
    expect(buildServerOptions({ NODE_ENV: 'test', LOG_LEVEL: 'info' }).trustProxy).toBe(false);
  });

  it('disables Fastify built-in request logging so URLs with secrets are not logged', () => {
    for (const NODE_ENV of ['development', 'production', 'test'] as const) {
      const options = buildServerOptions({ NODE_ENV, LOG_LEVEL: 'info' });
      expect(options.disableRequestLogging).toBe(true);
    }
  });

  it('keeps pino-pretty transport only in development', () => {
    const dev = buildServerOptions({ NODE_ENV: 'development', LOG_LEVEL: 'info' });
    const prod = buildServerOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });

    expect((dev.logger as { transport?: unknown }).transport).toBeDefined();
    expect((prod.logger as { transport?: unknown }).transport).toBeUndefined();
  });

  it('disables Fastify request-id header trust and validates inside genReqId', () => {
    const options = buildServerOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(options.requestIdHeader).toBe(false);
    expect(options.requestIdLogLabel).toBe('requestId');
    expect(typeof options.genReqId).toBe('function');
  });

  it('builds pino options with redaction paths and err serializer', () => {
    const options = buildServerOptions({ NODE_ENV: 'test', LOG_LEVEL: 'warn' });
    const logger = options.logger as {
      level: string;
      redact?: { paths?: string[] };
      formatters?: { log?: (obj: Record<string, unknown>) => Record<string, unknown> };
      serializers?: { err?: (err: unknown) => unknown };
    };

    expect(logger.level).toBe('warn');
    expect(logger.redact?.paths).toContain('req.headers.authorization');
    expect(logger.redact?.paths).toContain('prompt');
    expect(typeof logger.formatters?.log).toBe('function');
    expect(typeof logger.serializers?.err).toBe('function');

    // formatters.log redacts sensitive field names and nested secrets.
    const out = logger.formatters!.log!({
      systemPrompt: 'secret instructions',
      url: '/x?access_token=ghp_1234567890abcdefghij',
    });
    expect(out.systemPrompt).toBe('[redacted]');
    expect(JSON.stringify(out)).not.toContain('ghp_1234567890');
  });
});

describe('resolveRequestId', () => {
  it('accepts safe trace-style IDs', () => {
    expect(resolveRequestId('trace-abc.123')).toBe('trace-abc.123');
    expect(resolveRequestId('a'.repeat(128))).toBe('a'.repeat(128));
  });

  it('replaces unsafe values with a generated UUID', () => {
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(resolveRequestId('has space')).toMatch(uuidLike);
    expect(resolveRequestId('a'.repeat(129))).toMatch(uuidLike);
    expect(resolveRequestId(['array'])).toMatch(uuidLike);
    expect(resolveRequestId(undefined)).toMatch(uuidLike);
    expect(resolveRequestId('')).toMatch(uuidLike);
  });
});
