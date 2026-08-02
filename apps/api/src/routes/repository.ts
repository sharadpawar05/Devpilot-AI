import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { repositoryIndexer } from '../services/repository-indexer';
import { repositoryStatusService } from '../services/repository-status';
import { repositoryCache } from '../services/repository-cache';

export default async function repositoryRoutes(app: FastifyInstance) {
  app.get(
    '/repositories/:owner/:repo/index-status',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const { owner, repo } = request.params as { owner: string; repo: string };
      const branch = (request.query as { branch?: string }).branch || 'main';
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
      const { owner, repo } = request.params as { owner: string; repo: string };
      const { branch = 'main' } = (request.body as { branch?: string }) || {};
      const userId = request.auth!.sub;

      const existingStatus = await repositoryStatusService.getStatus(userId, owner, repo, branch);
      if (existingStatus === 'INDEXING') {
        return reply.status(409).send({
          success: false,
          error: { message: 'Indexing already in progress' },
        });
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
      const { owner, repo } = request.params as { owner: string; repo: string };
      const { branch = 'main' } = (request.body as { branch?: string }) || {};
      const userId = request.auth!.sub;

      const existingStatus = await repositoryStatusService.getStatus(userId, owner, repo, branch);
      if (existingStatus === 'INDEXING') {
        return reply.status(409).send({
          success: false,
          error: { message: 'Indexing already in progress' },
        });
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
      const { owner, repo } = request.params as { owner: string; repo: string };
      const branch = (request.query as { branch?: string }).branch || 'main';
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
      const { owner, repo } = request.params as { owner: string; repo: string };
      const { path, branch = 'main' } = request.query as { path?: string; branch?: string };
      const userId = request.auth!.sub;

      if (!path) {
        return reply.status(400).send({
          success: false,
          error: { message: 'path query parameter is required' },
        });
      }

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
