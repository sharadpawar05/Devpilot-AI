import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { engineeringStatusService } from './engineering-status-service';
import { usageService } from '@/core/usage';

const engineeringStatusSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  timeRange: z.enum(['7d', '14d', '30d', 'custom']).default('14d'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
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

      // Check AI report limit
      const limitCheck = await usageService.checkAiReportLimit(auth.sub);
      if (!limitCheck.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'PLAN_LIMIT_REACHED',
            message: `Free plan allows up to ${limitCheck.limit} AI reports per month. You have used ${limitCheck.used}/${limitCheck.limit}.`,
          },
        });
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
        const status = result.error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
        return reply.status(status).send(result);
      }

      // Increment usage after successful generation
      await usageService.incrementAiReport(auth.sub);

      return reply.send(result);
    },
  );
}
