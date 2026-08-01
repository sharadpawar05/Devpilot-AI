import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';

export async function registerCookies(app: FastifyInstance) {
  await app.register(cookie);
}
