import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { incidentSummaryService } from './incident-summary-service';

const incidentSummarySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  incidentTitle: z.string().min(1),
  severity: z.enum(['P0', 'P1', 'P2', 'P3']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  description: z.string().optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

export async function incidentSummaryRoutes(app: FastifyInstance) {
  app.post(
    '/incident-summary/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate an incident summary report',
        tags: ['incident-summary'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
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

      const {
        owner,
        repo,
        branch,
        incidentTitle,
        severity,
        startDate,
        endDate,
        description,
        provider,
      } = parsed.data;

      if (new Date(startDate) > new Date(endDate)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_DATE_RANGE', message: 'Start date must be before end date' },
        });
      }

      const result = await incidentSummaryService.generateReport(auth.sub, {
        owner,
        repo,
        branch,
        incidentTitle,
        severity,
        startDate,
        endDate,
        description,
        provider,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    },
  );
}
