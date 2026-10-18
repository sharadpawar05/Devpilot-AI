import type { FastifyServerOptions } from 'fastify';

export interface ServerEnvOptions {
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/**
 * Builds Fastify server options.
 *
 * - `disableRequestLogging`: Fastify's built-in "incoming request" logs
 *   include the full URL with query string (e.g. the GitHub OAuth
 *   `code`/`state` on /github/callback). The custom request logger emits the
 *   same observability data with sensitive query parameters redacted.
 * - `trustProxy`: in production the API runs behind Render's reverse proxy,
 *   so `request.ip` is the proxy address unless X-Forwarded-For is trusted.
 *   Without this, per-IP rate limiting buckets every user into one shared
 *   key. Disabled outside production so a directly-exposed instance cannot
 *   be tricked by spoofed X-Forwarded-For headers.
 */
export function buildServerOptions(env: ServerEnvOptions): FastifyServerOptions {
  return {
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    disableRequestLogging: true,
    trustProxy: env.NODE_ENV === 'production',
  };
}
