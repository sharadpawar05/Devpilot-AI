import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { engineeringStatusService } from './engineering-status-service';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import {
  githubOwnerSchema,
  githubRepoSchema,
  githubBranchSchema,
} from '@/core/validation/repository';

const engineeringStatusSchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
  branch: githubBranchSchema.default('main'),
  timeRange: z.enum(['7d', '14d', '30d', 'custom']).default('14d'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
});

export async function engineeringStatusRoutes(app: FastifyInstance) {
  app.post(
    '/engineering-status/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate an engineering status report',
        tags: ['engineering-status'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = engineeringStatusSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { owner, repo, branch, timeRange, startDate, endDate, provider } = parsed.data;

      if (timeRange === 'custom' && startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_DATE_RANGE', message: 'Start date must be before end date' },
          });
        }
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

      const result = await engineeringStatusService.generateReport(auth.sub, {
        owner,
        repo,
        branch,
        timeRange,
        startDate,
        endDate,
        provider,
      });

      if (!result.success) {
        // Refund quota when generation failed after consumption
        await usageService.refundWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
        const status = result.error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
        return reply.status(status).send(result);
      }

      return reply.send(result);
    },
  );
}
