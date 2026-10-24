import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { incidentSummaryService } from './incident-summary-service';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import {
  githubOwnerSchema,
  githubRepoSchema,
  githubBranchSchema,
} from '@/core/validation/repository';

const incidentSummarySchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
  branch: githubBranchSchema.default('main'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
});

export async function incidentSummaryRoutes(app: FastifyInstance) {
  app.post(
    '/incident-summary/generate',
    {
      preHandler: [authenticate],
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' }, // AI report,
      },
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
              message: parsed.error.issues.map((e) => e.message).join(', '),
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

        // Reject new repository activation before expensive AI work.
        const repoAccess = await usageService.ensureRepositoryAccess(auth.sub, owner, repo);
        if (!repoAccess.allowed && repoAccess.details) {
          return sendUsageLimitReached(reply, repoAccess.details);
        }

        // Atomically consume AI report + AI credits before generation
        const consume = await usageService.consumeWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
        if (!consume.allowed && consume.details) {
          return sendUsageLimitReached(reply, consume.details);
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
          // Failed generation must not consume quota
          await usageService.refundWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
          const status = result.error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
          return reply.status(status).send(result);
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ err: error }, 'Incident summary generation error');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'Failed to generate incident summary',
          },
        });
      }
    },
  );
}
