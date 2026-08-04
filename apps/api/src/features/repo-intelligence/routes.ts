import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { intelligenceService } from './intelligence-service';

const analyzeQuerySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().optional(),
});

const invalidateBodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().optional(),
});

export async function repoIntelligenceRoutes(app: FastifyInstance) {
  app.get(
    '/repo-intelligence/analyze',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Analyze a repository and return structured intelligence',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = analyzeQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({
            success: false,
            error: { message: parsed.error.errors[0]?.message || 'Invalid query' },
          });
      }

      const { owner, repo, branch } = parsed.data;

      try {
        const intelligence = await intelligenceService.analyze(auth.sub, owner, repo, branch);
        return reply.send({ success: true, data: intelligence });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        const status = err.status || 500;
        return reply.status(status).send({
          success: false,
          error: { message: err.message || 'Failed to analyze repository' },
        });
      }
    },
  );

  app.post(
    '/repo-intelligence/invalidate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Invalidate cached intelligence for a repository',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = invalidateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({
            success: false,
            error: { message: parsed.error.errors[0]?.message || 'Invalid body' },
          });
      }

      const { owner, repo, branch } = parsed.data;
      intelligenceService.invalidate(owner, repo, branch);
      return reply.send({ success: true, data: { message: 'Cache invalidated' } });
    },
  );
}
