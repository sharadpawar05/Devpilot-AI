import type { FastifyServerOptions } from 'fastify';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { LoggerOptions } from 'pino';
import { redactLogObject, redactDeep } from '@/core/logging/redact';

export interface ServerEnvOptions {
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/**
 * Request ID header accepted from upstream proxies/clients. A request ID that
 * arrives from the outside is only trusted when it is a short, safe token
 * (`trace-abc.123` style) — anything else is replaced with a generated UUID so
 * a hostile client cannot poison logs with newlines or huge values.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

const INBOUND_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(headerValue: unknown): string {
  if (typeof headerValue === 'string') {
    const trimmed = headerValue.trim();
    if (INBOUND_REQUEST_ID.test(trimmed)) {
      return trimmed;
    }
  }
  return randomUUID();
}

/**
 * pino options shared by the Fastify logger and the module-level root logger,
 * so request-scoped and background logs get the same redaction guarantees:
 *
 * - `redact`: paths pino scrubs itself (headers, credential-ish keys).
 * - `formatters.log`: recursive redaction of every structured field, including
 *   nested objects (secret-shaped strings, sensitive field names, prompts and
 *   source-code fields).
 * - `serializers.err`: the same redaction applied to error messages/stacks,
 *   which is where provider errors have historically leaked API keys.
 */
export function buildPinoOptions(env: ServerEnvOptions): LoggerOptions & { transport?: unknown } {
  return {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'req.headers["proxy-authorization"]',
        'headers.authorization',
        'headers.cookie',
        'headers["x-api-key"]',
        'authorization',
        'cookie',
        'apiKey',
        'api_key',
        'accessToken',
        'access_token',
        'refresh_token',
        'client_secret',
        'clientSecret',
        'githubAccessToken',
        'password',
        'secret',
        'token',
        'prompt',
        'systemPrompt',
      ],
      censor: '[redacted]',
    },
    formatters: {
      log: (obj: Record<string, unknown>) => redactLogObject(obj),
    },
    serializers: {
      err: (err: unknown) => redactDeep(err),
    },
  };
}

/**
 * Builds Fastify server options.
 *
 * - `genReqId` / `requestIdHeader`: every request gets a correlation ID —
 *   either a safe inbound `x-request-id` or a generated UUID. The ID is bound
 *   to Fastify's per-request child logger (`request.log`) and echoed in the
 *   `x-request-id` response header by the request logger.
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
    logger: buildPinoOptions(env),
    disableRequestLogging: true,
    trustProxy: env.NODE_ENV === 'production',
    // Fastify's own `requestIdHeader` path trusts the raw inbound header
    // verbatim (log-injection risk). It is disabled and the header is read +
    // validated inside `genReqId` instead.
    requestIdHeader: false,
    requestIdLogLabel: 'requestId',
    genReqId: (req: IncomingMessage) => resolveRequestId(req.headers[REQUEST_ID_HEADER]),
  };
}
