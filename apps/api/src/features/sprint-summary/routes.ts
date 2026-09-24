import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { sprintSummaryService } from './sprint-summary-service';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import { classifyAIError } from '@/core/ai/classify-error';

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
      try {
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

        // Atomically consume AI report + AI credits before generation
        const consume = await usageService.consumeWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
        if (!consume.allowed && consume.details) {
          return sendUsageLimitReached(reply, consume.details);
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
          await usageService.refundWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
          const status = result.error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
          return reply.status(status).send(result);
        }

        return reply.send(result);
      } catch (error) {
        console.error('Sprint summary generation error:', error);
        const classified = classifyAIError(error);
        return reply.status(classified.status === 429 ? 429 : 500).send({
          success: false,
          error: {
            code: classified.code === 'AI_ERROR' ? 'GENERATION_FAILED' : classified.code,
            message:
              classified.code === 'RATE_LIMIT_EXCEEDED'
                ? classified.message
                : 'Failed to generate sprint summary. Please try again.',
            retryable: classified.retryable,
          },
        });
      }
    },
  );
}
