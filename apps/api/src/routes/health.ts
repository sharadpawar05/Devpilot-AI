import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '@/core/db';

const systemSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    timestamp: { type: 'string' },
    uptimeSeconds: { type: 'number' },
    database: { type: 'string' },
  },
} as const;

export async function healthRoutes(app: FastifyInstance) {
  /**
   * Liveness: "is the process up and able to serve requests at all?"
   *
   * Deliberately touches no dependencies — a database outage must not cause
   * an orchestrator to kill and restart the app in a crash loop. Probe this
   * from process supervisors / container liveness checks.
   */
  app.get('/health/live', {
    schema: {
      description: 'Liveness probe — process is up (no dependency checks)',
      tags: ['system'],
      response: { 200: systemSchema },
    },
    config: { rateLimit: false },
    handler: async (_request, reply) =>
      reply.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      }),
  });

  /**
   * Readiness: "can this instance take traffic?"
   *
   * Checks database connectivity — the API cannot serve authenticated
   * traffic without it — and returns 503 so load balancers route around the
   * instance. Probe this from Render's health check / LB readiness probes.
   */
  app.get('/health/ready', {
    schema: {
      description: 'Readiness probe — includes database connectivity',
      tags: ['system'],
      response: { 200: systemSchema, 503: systemSchema },
    },
    config: { rateLimit: false },
    handler: async (_request, reply) => {
      const dbHealthy = await checkDatabaseConnection();
      return reply.status(dbHealthy ? 200 : 503).send({
        status: dbHealthy ? 'ok' : 'unavailable',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
      });
    },
  });

  /**
   * Combined health (kept for Render's `healthCheckPath` and existing
   * clients): reports database state like before.
   */
  app.get('/health', {
    schema: {
      description: 'Health check endpoint (database connectivity included)',
      tags: ['system'],
      response: {
        200: systemSchema,
        503: systemSchema,
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
