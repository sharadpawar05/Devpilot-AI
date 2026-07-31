import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, type AuthJWTPayload } from '@/middleware/auth';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthJWTPayload;
  }
}

export async function registerAuth(app: FastifyInstance) {
  app.decorate('authenticate', authenticate);

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
  });
}

export { authenticate, type AuthJWTPayload } from '@/middleware/auth';
