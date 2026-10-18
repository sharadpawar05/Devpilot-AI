import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '@/config';

/**
 * Returns the Access-Control-Allow-Origin value for a request origin,
 * or null when the origin is not allowed. Used by both the CORS plugin
 * and the SSE streaming route (which sets headers on reply.raw).
 */
export function resolveCorsOrigin(requestOrigin: string | undefined): string | null {
  const env = getEnv();
  if (env.CORS_ORIGIN === '*') {
    return '*';
  }
  const allowed = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (requestOrigin && allowed.includes(requestOrigin)) {
    return requestOrigin;
  }
  return null;
}

export async function registerCors(app: FastifyInstance) {
  const env = getEnv();
  const allowAll = env.CORS_ORIGIN === '*';
  const allowedOrigins = allowAll
    ? []
    : env.CORS_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean);

  await app.register(cors, {
    origin: allowAll ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // credentials + wildcard origin is rejected by browsers and unsafe:
    // only send credentials when an explicit allowlist is configured.
    credentials: !allowAll,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
}
