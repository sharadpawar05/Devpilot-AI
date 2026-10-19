import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from '@/config';

export async function registerRateLimit(app: FastifyInstance) {
  const env = getEnv();
  // Generous global ceiling per IP; AI-heavy routes attach stricter
  // per-route limits via route config.
  const globalMax = env.NODE_ENV === 'test' ? 10_000 : 300;

  await app.register(rateLimit, {
    global: true,
    max: globalMax,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    /**
     * Standard API error envelope for 429s. Without this, the plugin's
     * default error text ("Rate limit exceeded…") falls through to the
     * generic sanitizer and clients see a misleading `GITHUB_RATE_LIMIT`
     * code. `expose: true` routes it through the error handler's exposed
     * path: the code/message survive verbatim and `requestId` is attached.
     */
    errorResponseBuilder: (
      _request: FastifyRequest,
      context: { statusCode?: number; after: string },
    ) => {
      const error = new Error(
        `Too many requests. Please try again in ${context.after}.`,
      ) as Error & { statusCode?: number; code?: string; expose?: boolean };
      error.statusCode = context.statusCode ?? 429;
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.expose = true;
      return error;
    },
  });
}
