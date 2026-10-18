import type { FastifyInstance } from 'fastify';
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
  });
}
