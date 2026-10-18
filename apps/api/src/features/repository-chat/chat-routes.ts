import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import { repositoryIndexer } from './indexer';
import { repositoryStatusService } from './status';
import { buildTreeSummary, findFilesByKeywords } from './parser';
import { db } from '@/core/db';
import { config } from '@devpilot/config';
import { usageService, sendUsageLimitReached } from '@/core/usage';
import {
  githubOwnerSchema,
  githubRepoSchema,
  githubBranchSchema,
} from '@/core/validation/repository';

const MAX_FILE_SIZE = 50_000;
const MAX_CONTEXT_FILES = 15;

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'qwen/qwen3.8-27b',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
};

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
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
  branch: githubBranchSchema.default('main'),
});

const repoQuerySchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
  branch: githubBranchSchema.default('main'),
});

const chatSchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoSchema,
  branch: githubBranchSchema.default('main'),
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
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
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

        // Reject activating a new repository beyond the plan limit before indexing.
        const repoAccess = await usageService.ensureRepositoryAccess(auth.sub, owner, repo);
        if (!repoAccess.allowed && repoAccess.details) {
          return sendUsageLimitReached(reply, repoAccess.details);
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
        const err = error as { status?: number };
        app.log.error({ err: error, owner, repo, branch }, 'Repository indexing failed');
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
          error: { message: 'Failed to index repository' },
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
      const parsed = repoQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message },
        });
      }
      const { owner, repo, branch } = parsed.data;

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
      config: {
        // AI chat is expensive — tighter than the global ceiling.
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
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

      const availableProviders = aiService.getAvailableProviders();
      if (!availableProviders.includes(provider)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `Provider '${provider}' is not configured. Available: ${availableProviders.join(', ') || 'none'}. Set the corresponding API key in your .env file.`,
          },
        });
      }

      // Chat requires an index; if somehow reached for a non-active repo, enforce limit.
      const repoAccess = await usageService.ensureRepositoryAccess(auth.sub, owner, repo);
      if (!repoAccess.allowed && repoAccess.details) {
        return sendUsageLimitReached(reply, repoAccess.details);
      }

      const index = await repositoryIndexer.getIndex(auth.sub, owner, repo, branch);
      if (!index) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Repository not indexed. Please index the repository first.' },
        });
      }

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
          const content = await repositoryIntelligenceService.getFileContent(
            auth.sub,
            owner,
            repo,
            filePath,
            branch,
          );
          if (content) {
            fileContents[filePath] =
              content.content.length > MAX_FILE_SIZE
                ? content.content.slice(0, MAX_FILE_SIZE) + '\n... (truncated)'
                : content.content;
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

      const systemPrompt = `You are a helpful code assistant chatbot, similar to GitHub Copilot Chat or ChatGPT.

Core rules:
- Answer the user's question directly in the first sentence.
- Keep responses concise: 3-8 paragraphs for simple questions.
- Only generate detailed reports when explicitly asked (e.g., "generate a report", "full architecture review").
- Use bullet lists, numbered lists, bold text, and code blocks for clarity.
- Use headings only for complex multi-part answers.
- Reference repository files only when directly relevant. Say "in the indexing layer" instead of listing file paths.
- Never invent or hallucinate file paths. Only mention files that exist in the provided context.
- Be conversational and professional, not academic.
- Elaborate only when the user asks for more details.

Formatting:
- Use markdown: bullet lists, numbered lists, bold, inline code, fenced code blocks, tables.
- Avoid excessive horizontal rules (---).
- No unnecessary headers for simple answers.

Context:
You have access to the repository structure and relevant code files. Use them to answer questions accurately, but don't dump file listings unless asked.`;

      const userPrompt = `Repository: ${owner}/${repo} (branch: ${branch})

Repository Structure:
${treeSummary}

Key Configuration Files:
${keyFilesContext}

Relevant Code Files:
${relevantContext || '(No specific files matched - provide a general answer based on the repository structure)'}
${conversationContext}

Question: ${question}`;

      const questionLower = question.toLowerCase();
      const isReportRequest =
        questionLower.includes('generate') &&
        (questionLower.includes('report') ||
          questionLower.includes('review') ||
          questionLower.includes('analysis'));
      const isDetailedRequest =
        questionLower.includes('detailed') ||
        questionLower.includes('comprehensive') ||
        questionLower.includes('full') ||
        questionLower.includes('complete') ||
        questionLower.includes('in-depth');

      const maxTokens = isReportRequest || isDetailedRequest ? 4096 : 1500;
      const selectedModel =
        model || PROVIDER_DEFAULT_MODELS[provider] || config.ai.defaultModel || 'gemini-3.6-flash';

      // Atomically consume chat message + AI credits before generation
      const consume = await usageService.consumeWithCredits(
        auth.sub,
        'CHAT_MESSAGE',
        'REPOSITORY_CHAT',
      );
      if (!consume.allowed && consume.details) {
        return sendUsageLimitReached(reply, consume.details);
      }

      try {
        const response = await aiService.generate(userPrompt, systemPrompt, {
          provider: provider as 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq',
          model: selectedModel as never,
          maxTokens,
        });

        await usageService.recordAIUsageEvent({
          userId: auth.sub,
          feature: 'REPOSITORY_CHAT',
          model: response.model,
          inputTokens: response.tokens.input,
          outputTokens: response.tokens.output,
          creditsConsumed: 5,
          estimatedCostUsd: response.cost?.totalCost ?? 0,
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
        await usageService.refundWithCredits(auth.sub, 'CHAT_MESSAGE', 'REPOSITORY_CHAT');
        const classified = classifyAIError(error);
        app.log.error({ err: error, provider, model: selectedModel }, 'Repository chat AI failed');
        return reply.status(classified.status).send({
          success: false,
          error: {
            code: classified.code,
            message: classified.message,
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
      const parsed = repoQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message },
        });
      }
      const { owner, repo, branch } = parsed.data;

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
