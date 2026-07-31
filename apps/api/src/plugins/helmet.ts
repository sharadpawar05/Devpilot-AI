import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { getEnv } from '@/config';

export async function registerHelmet(app: FastifyInstance) {
  const env = getEnv();

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });
}
