import { describe, it, expect } from 'vitest';
import { buildServerOptions } from '@/core/http/server-options';

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
});
