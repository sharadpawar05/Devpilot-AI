import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { getEnv } from '@/config';

export async function registerCookies(app: FastifyInstance) {
  const env = getEnv();
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
  });
}
