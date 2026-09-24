import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/core/auth/middleware';
import { usageService } from '@/core/usage';

export async function usageRoutes(app: FastifyInstance) {
  app.get(
    '/usage',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get current user usage stats, plan limits, and remaining quota',
        tags: ['usage'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;

      try {
        const usage = await usageService.getUsageSummary(auth.sub);
        return reply.send({ success: true, data: usage });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch usage');
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch usage data' },
        });
      }
    },
  );
}
