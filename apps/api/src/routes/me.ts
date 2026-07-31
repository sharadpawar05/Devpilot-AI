import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/auth';

export async function meRoutes(app: FastifyInstance) {
  app.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Returns the authenticated user profile',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const auth = (request as { auth: { sub: string; email?: string } }).auth;
      return {
        success: true,
        data: {
          id: auth.sub,
          email: auth.email,
        },
      };
    },
  );
}
