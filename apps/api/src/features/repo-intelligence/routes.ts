import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth/middleware';
import { repositoryIntelligenceService } from './repository-service';
import { extractCoverage } from './health-trend';
import { usageService, sendUsageLimitReached } from '@/core/usage';

const querySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().optional(),
});

const prQuerySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pull_number: z.coerce.number().min(1),
});

const invalidateBodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function repoIntelligenceRoutes(app: FastifyInstance) {
  // ─── Overview ────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/overview',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository overview with metadata, statistics, and health',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const [metadata, statistics, health, languages, contributors, tree] = await Promise.all([
          repositoryIntelligenceService.getMetadata(auth.sub, owner, repo),
          repositoryIntelligenceService.getStatistics(auth.sub, owner, repo),
          repositoryIntelligenceService.getHealth(auth.sub, owner, repo),
          repositoryIntelligenceService.getLanguages(auth.sub, owner, repo),
          repositoryIntelligenceService.getContributors(auth.sub, owner, repo),
          repositoryIntelligenceService.getFileTree(auth.sub, owner, repo),
        ]);

        return reply.send({
          success: true,
          data: { metadata, statistics, health, languages, contributors, tree },
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        const status = err.status || 500;
        return reply.status(status).send({
          success: false,
          error: { message: err.message || 'Failed to fetch repository overview' },
        });
      }
    },
  );

  // ─── Metadata ────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/metadata',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository metadata',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const metadata = await repositoryIntelligenceService.getMetadata(auth.sub, owner, repo);
        return reply.send({ success: true, data: metadata });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch metadata' },
        });
      }
    },
  );

  // ─── Contributors ────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/contributors',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository contributors',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const contributors = await repositoryIntelligenceService.getContributors(
          auth.sub,
          owner,
          repo,
        );
        return reply.send({ success: true, data: contributors });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch contributors' },
        });
      }
    },
  );

  // ─── Pull Requests ───────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/pull-requests',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository pull requests',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema
        .extend({ state: z.enum(['open', 'closed', 'all']).default('open') })
        .safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, state } = parsed.data;

      try {
        const pulls = await repositoryIntelligenceService.getPullRequests(
          auth.sub,
          owner,
          repo,
          state,
        );
        return reply.send({ success: true, data: pulls });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch pull requests' },
        });
      }
    },
  );

  // ─── Pull Request Files ──────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/pull-requests/:pull_number/files',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get files changed in a pull request',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = prQuerySchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, pull_number } = parsed.data;

      try {
        const files = await repositoryIntelligenceService.getPullRequestFiles(
          auth.sub,
          owner,
          repo,
          pull_number,
        );
        return reply.send({ success: true, data: files });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch PR files' },
        });
      }
    },
  );

  // ─── Commits ─────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/commits',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository commits',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, branch } = parsed.data;

      try {
        const commits = await repositoryIntelligenceService.getCommits(
          auth.sub,
          owner,
          repo,
          branch,
        );
        return reply.send({ success: true, data: commits });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch commits' },
        });
      }
    },
  );

  // ─── Releases ────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/releases',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository releases',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const releases = await repositoryIntelligenceService.getReleases(auth.sub, owner, repo);
        return reply.send({ success: true, data: releases });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch releases' },
        });
      }
    },
  );

  // ─── Issues ──────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/issues',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository issues',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema
        .extend({ state: z.enum(['open', 'closed', 'all']).default('open') })
        .safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, state } = parsed.data;

      try {
        const issues = await repositoryIntelligenceService.getIssues(auth.sub, owner, repo, state);
        return reply.send({ success: true, data: issues });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch issues' },
        });
      }
    },
  );

  // ─── Activity ────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/activity',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get recent repository activity',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const activity = await repositoryIntelligenceService.getRecentActivity(
          auth.sub,
          owner,
          repo,
        );
        return reply.send({ success: true, data: activity });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch activity' },
        });
      }
    },
  );

  // ─── Commit Activity ─────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/commit-activity',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get commit activity statistics',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const activity = await repositoryIntelligenceService.getCommitActivity(
          auth.sub,
          owner,
          repo,
        );
        return reply.send({ success: true, data: activity });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch commit activity' },
        });
      }
    },
  );

  // ─── File Tree ───────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/file-tree',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository file tree',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, branch } = parsed.data;

      try {
        const tree = await repositoryIntelligenceService.getFileTree(auth.sub, owner, repo, branch);
        return reply.send({ success: true, data: tree });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch file tree' },
        });
      }
    },
  );

  // ─── File Content ────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/file-content',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get file content from repository',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo, path, branch } = request.query as {
        owner?: string;
        repo?: string;
        path?: string;
        branch?: string;
      };

      if (!owner || !repo || !path) {
        return reply.status(400).send({
          success: false,
          error: { message: 'owner, repo, and path are required' },
        });
      }

      try {
        const content = await repositoryIntelligenceService.getFileContent(
          auth.sub,
          owner,
          repo,
          path,
          branch,
        );

        if (!content) {
          return reply.status(404).send({
            success: false,
            error: { message: 'File not found' },
          });
        }

        return reply.send({ success: true, data: content });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch file content' },
        });
      }
    },
  );

  // ─── Health ──────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/health',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository health metrics',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      let consumed = false;
      try {
        // Get current commit SHA for cache key
        const commitSha = await repositoryIntelligenceService.getLatestCommitSha(
          auth.sub,
          owner,
          repo,
        );

        // Check cache first — cached results consume no quota
        if (commitSha) {
          const cached = await usageService.getHealthCache(auth.sub, owner, repo, commitSha);
          if (cached) {
            const meta = await repositoryIntelligenceService.getHealthMeta(
              auth.sub,
              owner,
              repo,
              { score: cached.score, coverage: extractCoverage(cached.summary) },
              { excludeCommitSha: commitSha, updatedAt: cached.createdAt.toISOString() },
            );
            return reply.send({
              success: true,
              data: {
                score: cached.score,
                passedCount: cached.passedCount,
                failedCount: cached.failedCount,
                criticalCount: cached.criticalCount,
                summary: cached.summary as Record<string, unknown>,
                scoreBreakdown: cached.scoreBreakdown as Record<string, unknown>,
                details: cached.details as Record<string, unknown>,
                updatedAt: meta.updatedAt,
                trend: meta.trend,
                cached: true,
              },
            });
          }
        }

        // Atomically consume the health scan quota before running a new scan.
        // Health scans are deterministic analysis — they never spend AI credits.
        const consume = await usageService.consumeQuota(auth.sub, 'HEALTH_SCAN');
        if (!consume.allowed && consume.details) {
          return sendUsageLimitReached(reply, consume.details);
        }
        consumed = true;

        // Run health analysis
        const health = await repositoryIntelligenceService.getHealth(auth.sub, owner, repo);

        // Refund quota if analysis failed after consumption
        // (getHealth throws on failure, so refund happens in catch)

        // Save to cache if we have commit SHA
        if (commitSha) {
          await usageService
            .saveHealthCache(auth.sub, owner, repo, commitSha, {
              score: health.score,
              passedCount: health.passedCount,
              failedCount: health.failedCount,
              criticalCount: health.criticalCount,
              structuralScore: health.summary.structuralScore,
              qualityScore: health.summary.qualityScore,
              details: health.details,
              scoreBreakdown: health.scoreBreakdown,
              summary: health.summary,
            })
            .catch(() => {
              // Best-effort cache save
            });
        }

        return reply.send({ success: true, data: health });
      } catch (error: unknown) {
        // Refund only if this request actually consumed a health scan quota.
        if (consumed) {
          await usageService.refundQuota(auth.sub, 'HEALTH_SCAN');
        }
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch health' },
        });
      }
    },
  );

  // ─── Health History ────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/health/history',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get recent health score snapshots for trend charting',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema
        .extend({ limit: z.coerce.number().int().min(1).max(90).default(30) })
        .safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, limit } = parsed.data;

      try {
        const points = await repositoryIntelligenceService.getHealthHistory(
          auth.sub,
          owner,
          repo,
          limit,
        );
        return reply.send({ success: true, data: { points } });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch health history' },
        });
      }
    },
  );

  // ─── Technology Analysis ─────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/analyze',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Analyze repository technology stack',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo, branch } = parsed.data;

      try {
        const intelligence = await repositoryIntelligenceService.getTechnologyAnalysis(
          auth.sub,
          owner,
          repo,
          branch,
        );
        return reply.send({ success: true, data: intelligence });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to analyze repository' },
        });
      }
    },
  );

  // ─── Readme ──────────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/readme',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository README content',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const readme = await repositoryIntelligenceService.getReadme(auth.sub, owner, repo);
        return reply.send({ success: true, data: { content: readme } });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch README' },
        });
      }
    },
  );

  // ─── Statistics ──────────────────────────────────────────────────────────

  app.get(
    '/repo-intelligence/statistics',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository statistics',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;

      try {
        const statistics = await repositoryIntelligenceService.getStatistics(auth.sub, owner, repo);
        return reply.send({ success: true, data: statistics });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch statistics' },
        });
      }
    },
  );

  // ─── Invalidate Cache ────────────────────────────────────────────────────

  app.post(
    '/repo-intelligence/invalidate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Invalidate cached data for a repository',
        tags: ['repo-intelligence'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = invalidateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0]?.message } });
      }

      const { owner, repo } = parsed.data;
      repositoryIntelligenceService.invalidate(owner, repo);
      return reply.send({ success: true, data: { message: 'Cache invalidated' } });
    },
  );
}
