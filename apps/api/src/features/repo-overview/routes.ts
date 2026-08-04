import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { getOctokit } from '@/core/github';
import { aiService } from '@/core/ai/service';
import { repoOverviewService } from './overview-service';
import { generatorService } from './generator-service';
import { repositoryAnalyzer } from './analyzer-service';
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
        const err = error as { status?: number; message?: string };
        if (err.status === 404) {
          return reply.status(404).send({
            success: false,
            error: { message: 'Repository not found' },
          });
        }
        if (err.status === 401) {
          return reply.status(401).send({
            success: false,
            error: { message: 'GitHub authentication failed' },
          });
        }
        return reply.status(500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch repository overview' },
        });
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
        const octokit = await getOctokit(auth.sub);
        const { data: treeData } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: 'HEAD',
          recursive: 'true',
        });

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

        const tree = (treeData.tree as Array<{ path: string; type: string; size?: number }>)
          .filter((item) => {
            const name = item.path.split('/').pop() || '';
            if (item.type === 'tree')
              return !IGNORED.has(name) && !(name.startsWith('.') && name !== '.github');
            return true;
          })
          .slice(0, 500)
          .map((item) => ({
            path: item.path,
            name: item.path.split('/').pop() || '',
            type: item.type === 'tree' ? ('dir' as const) : ('file' as const),
            size: item.size,
          }));

        return reply.send({ success: true, tree });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch repository tree' },
        });
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
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: 'HEAD',
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return reply.send({
            success: true,
            content,
            name: data.name,
            path: data.path,
            size: data.size,
          });
        }

        return reply.status(404).send({
          success: false,
          error: { message: 'File not found or is a directory' },
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch file content' },
        });
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
        const octokit = await getOctokit(auth.sub);

        const [readmeResult, packageJsonResult, overview] = await Promise.allSettled([
          octokit.rest.repos.getReadme({ owner, repo }),
          octokit.rest.repos.getContent({ owner, repo, path: 'package.json' }),
          repoOverviewService.getOverview(auth.sub, owner, repo),
        ]);

        let readmeContent = '';
        if (readmeResult.status === 'fulfilled' && 'content' in readmeResult.value.data) {
          readmeContent = Buffer.from(readmeResult.value.data.content, 'base64').toString('utf-8');
          readmeContent = readmeContent.slice(0, 8000);
        }

        let packageJsonContent = '';
        if (packageJsonResult.status === 'fulfilled' && 'content' in packageJsonResult.value.data) {
          packageJsonContent = Buffer.from(
            (packageJsonResult.value.data as { content: string }).content,
            'base64',
          ).toString('utf-8');
          packageJsonContent = packageJsonContent.slice(0, 5000);
        }

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
${readmeContent || 'No README found'}

Package.json:
${packageJsonContent || 'No package.json found'}

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
        const err = error as { status?: number; message?: string; code?: string };
        return reply.status(err.status || 502).send({
          success: false,
          error: {
            code: err.code || 'AI_ERROR',
            message: err.message || 'Failed to generate summary',
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
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.repos.listContributors({
          owner,
          repo,
          per_page: 20,
        });

        return reply.send({
          success: true,
          contributors: data.map((c) => ({
            login: c.login || '',
            avatar_url: c.avatar_url || '',
            contributions: c.contributions,
            html_url: c.html_url || '',
          })),
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        return reply.status(500).send({
          success: false,
          error: { message: err.message || 'Failed to fetch contributors' },
        });
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
        const err = error as { status?: number; message?: string };
        return reply.status(err.status || 500).send({
          success: false,
          error: { message: err.message || 'Failed to analyze repository' },
        });
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
        const err = error as { status?: number; message?: string; code?: string };

        // Handle missing required files gracefully
        if (err.message?.includes('not found') || err.status === 404) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'MISSING_FILES',
              message: `Unable to generate artifact: ${err.message}. Select another branch or verify the repository.`,
            },
          });
        }

        return reply.status(err.status || 502).send({
          success: false,
          error: {
            code: err.code || 'GENERATION_ERROR',
            message: err.message || 'Failed to generate artifact',
          },
        });
      }
    },
  );
}
