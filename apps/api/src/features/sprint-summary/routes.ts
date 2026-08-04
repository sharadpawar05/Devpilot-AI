import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { sprintSummaryService } from './sprint-summary-service';

const sprintSummarySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

export async function sprintSummaryRoutes(app: FastifyInstance) {
  app.post(
    '/sprint-summary/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate a sprint summary from repository activity',
        tags: ['sprint-summary'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = sprintSummarySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { owner, repo, branch, startDate, endDate, provider } = parsed.data;

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Start date must be before end date',
          },
        });
      }

      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 90) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'DATE_RANGE_TOO_LONG',
            message: 'Sprint period cannot exceed 90 days',
          },
        });
      }

      const result = await sprintSummaryService.generateSummary(auth.sub, {
        owner,
        repo,
        branch,
        startDate,
        endDate,
        provider,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    },
  );
}
