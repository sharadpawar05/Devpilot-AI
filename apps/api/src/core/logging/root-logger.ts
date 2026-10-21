import pino from 'pino';
import { buildPinoOptions } from '@/core/http/server-options';

/**
 * Module-level structured logger for code that runs outside a request scope
 * (background jobs, service modules, pure helpers like `sanitizeError`).
 *
 * Request-scoped logs use Fastify's child logger (`request.log`), which
 * carries the request ID. This logger uses the exact same pino options —
 * including the redaction formatters — so both channels are safe by default.
 *
 * Level resolution (overridable with LOG_LEVEL):
 * - `test`: `warn` — keeps test output readable while still surfacing real
 *   warnings and errors.
 * - otherwise: `info`.
 */
export const rootLogger = pino(
  buildPinoOptions({
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    LOG_LEVEL:
      (process.env.LOG_LEVEL as pino.Level | undefined) ??
      (process.env.NODE_ENV === 'test' ? 'warn' : 'info'),
  }),
);
