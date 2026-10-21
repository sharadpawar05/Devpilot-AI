import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { releaseNotesService } from './release-notes-service';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import { sanitizeError } from '@/core/errors/sanitize';
import { githubOwnerSchema, githubRepoSchema } from '@/core/validation/repository';

const releaseNotesSchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
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
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
});

export async function releaseNotesRoutes(app: FastifyInstance) {
  app.post(
    '/release-notes/generate',
    {
      preHandler: [authenticate],
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' }, // AI report,
      },
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
        await usageService.refundWithCredits(auth.sub, 'AI_REPORT', 'AI_REPORT');
        return reply.status(500).send(result);
      }

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
      const parsed = releaseNotesSchema.pick({ owner: true, repo: true }).safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid request',
          },
        });
      }
      const { owner, repo } = parsed.data;

      try {
        const tags = await releaseNotesService.getReleaseTags(auth.sub, owner, repo);
        return reply.send({ success: true, tags });
      } catch (error) {
        const sanitized = sanitizeError(error, 'FETCH_ERROR', 'Failed to fetch release tags.', 500);
        return reply.status(sanitized.statusCode).send({
          success: false,
          error: { code: sanitized.code, message: sanitized.message },
        });
      }
    },
  );
}
