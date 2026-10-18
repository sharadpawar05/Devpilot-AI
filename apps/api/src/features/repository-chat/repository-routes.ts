import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { repositoryIndexer } from './indexer';
import { repositoryStatusService } from './status';
import { repositoryCache } from './cache';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import {
  githubOwnerSchema,
  githubRepoSchema,
  githubBranchSchema,
  repoFilePathSchema,
} from '@/core/validation/repository';

const repoParamsSchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
});

const branchQuerySchema = z.object({
  branch: githubBranchSchema.default('main'),
});

const fileContentQuerySchema = repoParamsSchema.extend({
  path: repoFilePathSchema,
  branch: githubBranchSchema.default('main'),
});

const indexBodySchema = z.object({
  branch: githubBranchSchema.default('main'),
});

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message ?? 'Invalid request' },
  });
}

export default async function repositoryRoutes(app: FastifyInstance) {
  app.get(
    '/repositories/:owner/:repo/index-status',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const params = repoParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error);
      }
      const query = branchQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return validationError(reply, query.error);
      }
      const { owner, repo } = params.data;
      const branch = query.data.branch;
      const userId = request.auth!.sub;

      const status = await repositoryStatusService.getStatus(userId, owner, repo, branch);
      const commitSha = await repositoryCache.getCommitSha(userId, owner, repo, branch);

      return { success: true, status, commitSha, branch };
    },
  );

  app.post(
    '/repositories/:owner/:repo/index',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const params = repoParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error);
      }
      const body = indexBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return validationError(reply, body.error);
      }
      const { owner, repo } = params.data;
      const branch = body.data.branch;
      const userId = request.auth!.sub;

      const existingStatus = await repositoryStatusService.getStatus(userId, owner, repo, branch);
      if (existingStatus === 'INDEXING') {
        return reply.status(409).send({
          success: false,
          error: { message: 'Indexing already in progress' },
        });
      }

      // Reject activating a new repository beyond the plan limit before indexing.
      const repoAccess = await usageService.ensureRepositoryAccess(userId, owner, repo);
      if (!repoAccess.allowed && repoAccess.details) {
        return sendUsageLimitReached(reply, repoAccess.details);
      }

      repositoryIndexer.index(userId, owner, repo, branch).catch((err) => {
        app.log.error({ err, owner, repo, branch }, 'Background indexing failed');
      });

      return {
        success: true,
        message: 'Indexing started',
        status: 'INDEXING',
      };
    },
  );

  app.post(
    '/repositories/:owner/:repo/reindex',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const params = repoParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error);
      }
      const body = indexBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return validationError(reply, body.error);
      }
      const { owner, repo } = params.data;
      const branch = body.data.branch;
      const userId = request.auth!.sub;

      const existingStatus = await repositoryStatusService.getStatus(userId, owner, repo, branch);
      if (existingStatus === 'INDEXING') {
        return reply.status(409).send({
          success: false,
          error: { message: 'Indexing already in progress' },
        });
      }

      // Reject activating a new repository beyond the plan limit before reindexing.
      const repoAccess = await usageService.ensureRepositoryAccess(userId, owner, repo);
      if (!repoAccess.allowed && repoAccess.details) {
        return sendUsageLimitReached(reply, repoAccess.details);
      }

      await repositoryStatusService.markOutdated(userId, owner, repo, branch);

      repositoryIndexer.index(userId, owner, repo, branch).catch((err) => {
        app.log.error({ err, owner, repo, branch }, 'Background reindexing failed');
      });

      return {
        success: true,
        message: 'Reindexing started',
        status: 'INDEXING',
      };
    },
  );

  app.get(
    '/repositories/:owner/:repo/structure',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const params = repoParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error);
      }
      const query = branchQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return validationError(reply, query.error);
      }
      const { owner, repo } = params.data;
      const branch = query.data.branch;
      const userId = request.auth!.sub;

      const data = await repositoryIndexer.getIndex(userId, owner, repo, branch);
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Repository not indexed' },
        });
      }

      return {
        success: true,
        tree: data.tree,
        fileMetadata: data.fileMetadata,
        languageBreakdown: data.languageBreakdown,
        stats: data.stats,
        commitSha: data.commitSha,
        indexedAt: data.indexedAt,
      };
    },
  );

  app.get(
    '/repositories/:owner/:repo/file-content',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const parsed = fileContentQuerySchema.safeParse({
        ...(request.params as Record<string, unknown>),
        ...((request.query as Record<string, unknown>) ?? {}),
      });
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid request',
          },
        });
      }
      const { owner, repo, path, branch } = parsed.data;
      const userId = request.auth!.sub;

      const data = await repositoryIndexer.getIndex(userId, owner, repo, branch);
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Repository not indexed' },
        });
      }

      const fileMeta = data.fileMetadata.find((f) => f.path === path);
      if (!fileMeta) {
        return reply.status(404).send({
          success: false,
          error: { message: 'File not found in index' },
        });
      }

      return { success: true, file: fileMeta };
    },
  );
}
