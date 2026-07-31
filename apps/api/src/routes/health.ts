import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '@/lib/db';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['system'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      const dbHealthy = await checkDatabaseConnection();
      const status = dbHealthy ? 'ok' : 'degraded';

      return reply.status(dbHealthy ? 200 : 503).send({
        status,
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
      });
    },
  });
}
