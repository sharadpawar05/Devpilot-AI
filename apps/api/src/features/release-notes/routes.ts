import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { releaseNotesService } from './release-notes-service';
import { usageService } from '@/core/usage';

const releaseNotesSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  previousTag: z.string().optional(),
  currentTag: z.string().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

export async function releaseNotesRoutes(app: FastifyInstance) {
  app.post(
    '/release-notes/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate release notes from repository activity',
        tags: ['release-notes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = releaseNotesSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { owner, repo, previousTag, currentTag, startDate, endDate, provider } = parsed.data;

      if (startDate && endDate) {
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

      const result = await releaseNotesService.generateReleaseNotes(auth.sub, {
        owner,
        repo,
        previousTag,
        currentTag,
        startDate,
        endDate,
        provider,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      // Increment usage after successful generation
      await usageService.incrementAiReport(auth.sub);

      return reply.send(result);
    },
  );

  app.get(
    '/release-notes/tags',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get release tags for a repository',
        tags: ['release-notes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo } = request.query as { owner?: string; repo?: string };

      if (!owner || !repo) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'owner and repo are required' },
        });
      }

      try {
        const tags = await releaseNotesService.getReleaseTags(auth.sub, owner, repo);
        return reply.send({ success: true, tags });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_ERROR', message },
        });
      }
    },
  );
}
