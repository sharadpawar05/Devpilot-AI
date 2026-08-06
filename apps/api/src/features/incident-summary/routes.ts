import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { incidentSummaryService } from './incident-summary-service';

const incidentSummarySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

export async function incidentSummaryRoutes(app: FastifyInstance) {
  app.post(
    '/incident-summary/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate an incident summary from repository activity',
        tags: ['incident-summary'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const auth = (request as { auth: { sub: string } }).auth;
        const parsed = incidentSummarySchema.safeParse(request.body);

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
        if (diffDays > 30) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'DATE_RANGE_TOO_LONG',
              message: 'Incident period cannot exceed 30 days',
            },
          });
        }

        const result = await incidentSummaryService.generateSummary(auth.sub, {
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
      } catch (error) {
        console.error('Incident summary generation error:', error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to generate incident summary',
          },
        });
      }
    },
  );
}
