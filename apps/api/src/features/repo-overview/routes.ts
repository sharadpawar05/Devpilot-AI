import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import { repoOverviewService } from './overview-service';
import { generatorService } from './generator-service';
import { repositoryAnalyzer } from './analyzer-service';
import { sanitizeError, createErrorResponse } from '@/core/errors/sanitize';
import type { HealthActionType } from './types';

const overviewQuerySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const summarySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function repoOverviewRoutes(app: FastifyInstance) {
  app.get(
    '/repo-overview/overview',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository overview with metadata, structure, languages, and health',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo } = parsed.data;

      try {
        const data = await repoOverviewService.getOverview(auth.sub, owner, repo);
        return reply.send({ success: true, data });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'REPOSITORY_LOAD_FAILED',
          'Unable to load repository information.',
          500,
        );
        return reply.status(sanitized.statusCode).send(createErrorResponse(error));
      }
    },
  );

  app.get(
    '/repo-overview/tree',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository file tree',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo } = parsed.data;

      try {
        const tree = await repositoryIntelligenceService.getFileTree(auth.sub, owner, repo);

        const IGNORED = new Set([
          'node_modules',
          'dist',
          'build',
          'coverage',
          '.next',
          '.nuxt',
          '.git',
          '.turbo',
          '.cache',
          '.vercel',
          '.netlify',
          'vendor',
          '.gradle',
          'target',
          '__pycache__',
          '.tox',
          'venv',
          '.venv',
        ]);

        const filteredTree = tree
          .filter((item) => {
            const name = item.path.split('/').pop() || '';
            if (item.type === 'dir')
              return !IGNORED.has(name) && !(name.startsWith('.') && name !== '.github');
            return true;
          })
          .slice(0, 500)
          .map((item) => ({
            path: item.path,
            name: item.path.split('/').pop() || '',
            type: item.type === 'dir' ? ('dir' as const) : ('file' as const),
            size: item.size,
          }));

        return reply.send({ success: true, tree: filteredTree });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'TREE_LOAD_FAILED',
          'Unable to load repository structure.',
          500,
        );
        return reply.status(sanitized.statusCode).send(createErrorResponse(error));
      }
    },
  );

  app.get(
    '/repo-overview/file-content',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get file content from repository',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo, path } = request.query as {
        owner?: string;
        repo?: string;
        path?: string;
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
        );

        if (!content) {
          return reply.status(404).send({
            success: false,
            error: { message: 'File not found or is a directory' },
          });
        }

        return reply.send({
          success: true,
          content: content.content,
          name: content.name,
          path: content.path,
          size: content.size,
        });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'FILE_LOAD_FAILED',
          'Unable to load file content.',
          500,
        );
        return reply.status(sanitized.statusCode).send(createErrorResponse(error));
      }
    },
  );

  app.post(
    '/repo-overview/summary',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate AI summary of repository',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = summarySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo } = parsed.data;

      try {
        const [readmeContent, overview] = await Promise.allSettled([
          repositoryIntelligenceService.getReadme(auth.sub, owner, repo),
          repoOverviewService.getOverview(auth.sub, owner, repo),
        ]);

        const readme = readmeContent.status === 'fulfilled' ? readmeContent.value : '';
        const overviewData = overview.status === 'fulfilled' ? overview.value : null;

        const treeSummary = overviewData?.tree
          ? overviewData.tree
              .slice(0, 20)
              .map((n) => {
                const icon = n.type === 'dir' ? '📁' : '📄';
                const childCount = n.children ? ` (${n.children.length} items)` : '';
                return `${icon} ${n.name}${childCount}`;
              })
              .join('\n')
          : '';

        const langStr = overviewData?.languages
          ? Object.entries(overviewData.languages)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([lang, bytes]) => `${lang}: ${bytes} bytes`)
              .join(', ')
          : '';

        const systemPrompt = `You are a technical documentation expert. Analyze the repository and provide a clear, structured summary. Be concise but thorough. Use markdown formatting.`;

        const userPrompt = `Provide a comprehensive summary of this repository.

Repository: ${owner}/${repo}
Description: ${overviewData?.metadata.description || 'No description'}
Stars: ${overviewData?.metadata.stargazers_count || 0}
Primary Language: ${overviewData?.metadata.language || 'Unknown'}
License: ${overviewData?.metadata.license?.name || 'None'}
Created: ${overviewData?.metadata.created_at || 'Unknown'}
Last Updated: ${overviewData?.metadata.updated_at || 'Unknown'}

Languages: ${langStr || 'Unknown'}

Directory Structure:
${treeSummary || 'Not available'}

README Content:
${readme || 'No README found'}

Please provide:
1. **Project Purpose**: What this project does and why it exists
2. **Architecture**: High-level architecture and key components
3. **Primary Technologies**: Main technologies, frameworks, and tools used
4. **Strengths**: What the project does well
5. **Potential Improvements**: Areas that could be enhanced

Keep each section concise (2-4 sentences). Use markdown headers and bullet points.`;

        const response = await aiService.generate(userPrompt, systemPrompt, {
          provider: 'gemini',
          maxTokens: 2048,
        });

        return reply.send({
          success: true,
          summary: response.content,
        });
      } catch (error: unknown) {
        const sanitized = sanitizeError(error, 'AI_ERROR', 'Failed to generate summary.', 502);
        return reply.status(sanitized.statusCode).send({
          success: false,
          error: {
            code: sanitized.code,
            message: sanitized.message,
          },
        });
      }
    },
  );

  app.get(
    '/repo-overview/contributors',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository contributors',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo } = parsed.data;

      try {
        const contributors = await repositoryIntelligenceService.getContributors(
          auth.sub,
          owner,
          repo,
        );

        return reply.send({
          success: true,
          contributors,
        });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'CONTRIBUTORS_LOAD_FAILED',
          'Unable to load contributors.',
          500,
        );
        return reply.status(sanitized.statusCode).send(createErrorResponse(error));
      }
    },
  );

  // ─── Technology Analyzer ─────────────────────────────────────────────────

  app.get(
    '/repo-overview/analyze',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Analyze repository technology stack',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo } = parsed.data;

      try {
        const stack = await repositoryAnalyzer.analyze(auth.sub, owner, repo);
        return reply.send({ success: true, stack });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'ANALYSIS_FAILED',
          'Unable to analyze repository.',
          500,
        );
        return reply.status(sanitized.statusCode).send(createErrorResponse(error));
      }
    },
  );

  // ─── AI Generation ───────────────────────────────────────────────────────

  const generateSchema = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    actionType: z.enum([
      'generate-readme',
      'generate-license',
      'generate-gitignore',
      'generate-package-json',
      'generate-ci',
      'generate-tests',
      'generate-docs',
      'generate-dockerfile',
      'generate-env-example',
    ]),
  });

  app.post(
    '/repo-overview/generate',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Generate an AI-powered artifact for repository health',
        tags: ['repo-overview'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = generateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { message: parsed.error.errors[0].message },
        });
      }

      const { owner, repo, actionType } = parsed.data;

      try {
        const result = await generatorService.generate(
          auth.sub,
          owner,
          repo,
          actionType as HealthActionType,
        );

        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const sanitized = sanitizeError(
          error,
          'GENERATION_ERROR',
          'Failed to generate artifact.',
          502,
        );
        return reply.status(sanitized.statusCode).send({
          success: false,
          error: {
            code: sanitized.code,
            message: sanitized.message,
          },
        });
      }
    },
  );
}
