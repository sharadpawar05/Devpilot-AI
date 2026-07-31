import type { FastifyInstance } from 'fastify';
import { PACKAGE_VERSION } from '@/config';

export async function versionRoutes(app: FastifyInstance) {
  app.get('/version', {
    schema: {
      description: 'Returns the API version',
      tags: ['system'],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
          },
        },
      },
    },
    handler: async () => {
      return { version: PACKAGE_VERSION };
    },
  });
}
