import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { getOctokit } from '@/routes/github';
import { aiService } from '@/lib/ai';
import { repositoryIndexer } from '@/services/repository-indexer';
import { repositoryStatusService } from '@/services/repository-status';
import { buildTreeSummary, findFilesByKeywords } from '@/services/repository-parser';
import { db } from '@/lib/db';

const MAX_FILE_SIZE = 50_000;
const MAX_CONTEXT_FILES = 15;

async function ensureUserExists(supabaseUserId: string, email?: string): Promise<void> {
  const existing = await db.user.findUnique({
    where: { supabaseUserId },
    select: { id: true },
  });
  if (!existing) {
    await db.user.create({
      data: {
        supabaseUserId,
        email: email || `${supabaseUserId}@placeholder.local`,
        fullName: 'User',
      },
    });
  }
}

const indexSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
});

const chatSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  question: z.string().min(1).max(10000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
  model: z.string().optional(),
  fileFilter: z.string().optional(),
});

function buildKeyFilesContext(keyFiles: Record<string, string>): string {
  const parts: string[] = [];
  for (const [path, content] of Object.entries(keyFiles)) {
    const truncated =
      content.length > MAX_FILE_SIZE
        ? content.slice(0, MAX_FILE_SIZE) + '\n... (truncated)'
        : content;
    parts.push(`--- ${path} ---\n${truncated}`);
  }
  return parts.join('\n\n');
}

export async function repositoryChatRoutes(app: FastifyInstance) {
  app.post(
    '/repository-chat/index',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Index a GitHub repository for AI chat',
        tags: ['repository-chat'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string; email?: string } }).auth;
      const parsed = indexSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0].message } });
      }

      const { owner, repo, branch } = parsed.data;

      try {
        await ensureUserExists(auth.sub, auth.email as string | undefined);

        const existingStatus = await repositoryStatusService.getStatus(
          auth.sub,
          owner,
          repo,
          branch,
        );
        if (existingStatus === 'READY') {
          const cached = await repositoryIndexer.getIndex(auth.sub, owner, repo, branch);
          if (cached) {
            return reply.send({
              success: true,
              cached: true,
              tree: cached.tree,
              keyFiles: {},
              readme: '',
              packageJson: null,
              totalFiles: cached.stats.totalFiles,
              indexedAt: cached.indexedAt.toISOString(),
            });
          }
        }

        if (existingStatus === 'INDEXING') {
          return reply.status(409).send({
            success: false,
            error: { message: 'Indexing already in progress' },
          });
        }

        await repositoryStatusService.markIndexing(auth.sub, owner, repo, branch);

        repositoryIndexer.index(auth.sub, owner, repo, branch).catch(async (err) => {
          app.log.error({ err, owner, repo, branch }, 'Background indexing failed');
          await repositoryStatusService.markFailed(
            auth.sub,
            owner,
            repo,
            branch,
            err.message || 'Unknown error',
          );
        });

        return reply.send({
          success: true,
          cached: false,
          message: 'Indexing started',
          status: 'INDEXING',
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status === 404) {
          return reply
            .status(404)
            .send({ success: false, error: { message: 'Repository not found' } });
        }
        if (err.status === 401) {
          return reply
            .status(401)
            .send({ success: false, error: { message: 'GitHub authentication failed' } });
        }
        return reply.status(500).send({
          success: false,
          error: { message: err.message || 'Failed to index repository' },
        });
      }
    },
  );

  app.get(
    '/repository-chat/tree',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get repository file tree',
        tags: ['repository-chat'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const {
        owner,
        repo,
        branch = 'main',
      } = request.query as { owner?: string; repo?: string; branch?: string };

      if (!owner || !repo) {
        return reply
          .status(400)
          .send({ success: false, error: { message: 'owner and repo are required' } });
      }

      const data = await repositoryIndexer.getIndex(auth.sub, owner, repo, branch);
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Repository not indexed. Please index it first.' },
        });
      }

      return reply.send({
        success: true,
        tree: data.tree,
        totalFiles: data.stats.totalFiles,
        indexedAt: data.indexedAt.toISOString(),
      });
    },
  );

  app.post(
    '/repository-chat/chat',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Ask a question about a repository',
        tags: ['repository-chat'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = chatSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0].message } });
      }

      const { owner, repo, branch, question, conversationHistory, provider, model, fileFilter } =
        parsed.data;

      const index = await repositoryIndexer.getIndex(auth.sub, owner, repo, branch);
      if (!index) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Repository not indexed. Please index the repository first.' },
        });
      }

      const octokit = await getOctokit(auth.sub);

      let relevantFiles: string[] = [];
      if (fileFilter) {
        relevantFiles = findFilesByKeywords(index.tree, [fileFilter]);
      } else {
        const questionWords = question
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        relevantFiles = findFilesByKeywords(index.tree, questionWords);
      }
      relevantFiles = relevantFiles.slice(0, MAX_CONTEXT_FILES);

      const fileContents: Record<string, string> = {};
      for (const filePath of relevantFiles) {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch,
          });
          if ('content' in data && data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            fileContents[filePath] =
              content.length > MAX_FILE_SIZE
                ? content.slice(0, MAX_FILE_SIZE) + '\n... (truncated)'
                : content;
          }
        } catch {
          // Skip unreadable files
        }
      }

      const treeSummary = buildTreeSummary(index.tree);
      const keyFilesContext = buildKeyFilesContext({});
      const relevantContext = Object.entries(fileContents)
        .map(([path, content]) => `--- ${path} ---\n${content}`)
        .join('\n\n');

      const conversationContext =
        conversationHistory.length > 0
          ? '\n\nPrevious conversation:\n' +
            conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n')
          : '';

      const systemPrompt = `You are an expert code assistant helping developers understand their GitHub repository.
You have access to the repository structure, key configuration files, and relevant code files.

Always provide:
1. A clear summary of your answer
2. Detailed explanation with file references
3. Specific file paths when referencing code
4. Recommendations when applicable

When referencing files, use the exact file path from the repository tree.
Be concise but thorough. Focus on practical, actionable information.`;

      const userPrompt = `Repository: ${owner}/${repo} (branch: ${branch})

Repository Structure:
${treeSummary}

Key Configuration Files:
${keyFilesContext}

Relevant Code Files:
${relevantContext || '(No specific files matched - provide a general answer based on the repository structure)'}
${conversationContext}

Question: ${question}`;

      const maxTokens = 4096;

      try {
        const response = await aiService.generate(userPrompt, systemPrompt, {
          provider: provider as 'gemini' | 'openai' | 'anthropic' | 'openrouter',
          model: model as Parameters<typeof aiService.generate>[2] extends { model?: infer M }
            ? M
            : undefined,
          maxTokens,
        });

        return reply.send({
          success: true,
          response: response.content,
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
          usage: response.tokens,
          referencedFiles: Object.keys(fileContents),
          treeSummary: treeSummary.slice(0, 2000),
        });
      } catch (error: unknown) {
        const err = error as { message?: string; code?: string };
        return reply.status(502).send({
          success: false,
          error: {
            code: err.code || 'AI_ERROR',
            message: err.message || 'Failed to generate response',
          },
        });
      }
    },
  );

  app.get(
    '/repository-chat/status',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Check repository indexing status',
        tags: ['repository-chat'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const {
        owner,
        repo,
        branch = 'main',
      } = request.query as { owner?: string; repo?: string; branch?: string };

      if (!owner || !repo) {
        return reply
          .status(400)
          .send({ success: false, error: { message: 'owner and repo are required' } });
      }

      const status = await repositoryStatusService.getStatus(auth.sub, owner, repo, branch);
      const index = await repositoryIndexer.getIndex(auth.sub, owner, repo, branch);

      return reply.send({
        success: true,
        indexed: status === 'READY',
        status,
        totalFiles: index?.stats.totalFiles ?? 0,
        indexedAt: index?.indexedAt?.toISOString() ?? null,
      });
    },
  );
}
