import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { aiService } from '@/core/ai/service';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';
import { repositoryIntelligenceService } from '@/features/repo-intelligence';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

const reviewSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pull_number: z.number().min(1),
  files: z.array(z.string()).optional(),
  reviewType: z
    .enum(['Standard', 'Performance', 'Security', 'Maintainability', 'Architecture'])
    .default('Standard'),
  reviewDepth: z.enum(['Quick', 'Standard', 'Deep']).default('Standard'),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

const analyzeSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pull_number: z.number().min(1),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
});

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
};

const DEPTH_MAX_TOKENS: Record<string, number> = {
  Quick: 1024,
  Standard: 2048,
  Deep: 4096,
};

const MAX_DIFF_CHARS = 100_000;

interface AIErrorResponse {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
}

function classifyAIError(error: unknown): AIErrorResponse {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lowerMsg = rawMessage.toLowerCase();

  // Detect rate limit errors (429, "Too Many Requests", "rate limit", "quota")
  if (
    lowerMsg.includes('429') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota')
  ) {
    const retryMatch = rawMessage.match(/retry in (\d+\.?\d*)s/);
    const retrySeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : undefined;
    return {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: retrySeconds
        ? `Rate limit exceeded. Please wait ${retrySeconds} seconds and try again.`
        : 'Rate limit exceeded. Please wait a moment and try again.',
      retryable: true,
    };
  }

  // Detect invalid API key
  if (lowerMsg.includes('invalid api key') || lowerMsg.includes('unauthorized')) {
    return {
      status: 401,
      code: 'INVALID_API_KEY',
      message: 'Invalid API key. Please check your provider settings.',
      retryable: false,
    };
  }

  // Detect model not found
  if (lowerMsg.includes('model not found') || lowerMsg.includes('not found')) {
    return {
      status: 400,
      code: 'MODEL_NOT_FOUND',
      message: 'The selected model is not available. Please try a different provider.',
      retryable: false,
    };
  }

  // Detect context length exceeded
  if (lowerMsg.includes('context length') || lowerMsg.includes('too long')) {
    return {
      status: 400,
      code: 'CONTEXT_LENGTH_EXCEEDED',
      message: 'The content is too long for the AI model. Try reviewing fewer files.',
      retryable: false,
    };
  }

  // Detect provider not implemented
  if (lowerMsg.includes('not implemented')) {
    return {
      status: 501,
      code: 'PROVIDER_NOT_IMPLEMENTED',
      message: 'This provider is not yet implemented. Please try a different one.',
      retryable: false,
    };
  }

  // Default: return cleaned-up generic error
  let cleanMessage = rawMessage
    .replace(/^\[.*?\]\s*:?\s*/i, '') // Remove provider prefixes like [GoogleGenerativeAI Error]:
    .replace(/\[\d{3}\s+.*?\]\s*/g, '') // Remove HTTP status codes
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/\s*\[?\{.*$/s, '') // Remove JSON structures at the end
    .replace(/For more information.*$/i, '') // Remove "For more information..."
    .trim();

  if (cleanMessage.length > 200) {
    cleanMessage = cleanMessage.slice(0, 197) + '...';
  }

  return {
    status: 502,
    code: 'AI_ERROR',
    message: cleanMessage || 'An error occurred with the AI provider. Please try again.',
    retryable: true,
  };
}

function detectFileTypes(filenames: string[]): string {
  const frontendExts = new Set(['tsx', 'jsx', 'vue', 'svelte', 'css', 'scss', 'less', 'html']);
  const backendExts = new Set(['go', 'rs', 'java', 'py', 'rb', 'php', 'sql', 'graphql']);
  const docsExts = new Set(['md', 'mdx', 'txt', 'rst']);
  const configExts = new Set([
    'yml',
    'yaml',
    'json',
    'toml',
    'ini',
    'env',
    'lock',
    'gitignore',
    'dockerignore',
  ]);

  let hasFrontend = false;
  let hasBackend = false;
  let hasDocs = false;
  let hasConfig = false;
  let hasCode = false;

  for (const file of filenames) {
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    if (frontendExts.has(ext)) {
      hasFrontend = true;
      hasCode = true;
    } else if (backendExts.has(ext)) {
      hasBackend = true;
      hasCode = true;
    } else if (docsExts.has(ext)) {
      hasDocs = true;
    } else if (configExts.has(ext)) {
      hasConfig = true;
    } else {
      hasCode = true;
    }
  }

  if (hasDocs && !hasCode) return 'docs';
  if (hasConfig && !hasCode && !hasDocs) return 'config';
  if (hasFrontend && hasBackend) return 'full-stack';
  if (hasFrontend) return 'frontend';
  if (hasBackend) return 'backend';
  return 'mixed';
}

function detectLanguage(filenames: string[]): string {
  const ext = filenames[0]?.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    md: 'markdown',
  };
  return map[ext || ''] || 'plaintext';
}

export async function prReviewRoutes(app: FastifyInstance) {
  // POST /github/review
  app.post(
    '/github/review',
    {
      preHandler: [authenticate],
      schema: {
        description: 'AI-powered review of a GitHub pull request',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = reviewSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { owner, repo, pull_number, files, reviewType, reviewDepth, provider } = parsed.data;

      let prData;
      let filesData;
      try {
        const [prResult, filesResult] = await Promise.all([
          repositoryIntelligenceService.getPullRequest(auth.sub, owner, repo, pull_number),
          repositoryIntelligenceService.getPullRequestFiles(auth.sub, owner, repo, pull_number),
        ]);

        if (!prResult) {
          return reply.status(404).send({
            success: false,
            error: { code: 'PR_NOT_FOUND', message: 'Pull request not found' },
          });
        }

        prData = {
          title: prResult.title,
          body: prResult.body,
          user: { login: prResult.user },
          html_url: prResult.html_url,
          additions: prResult.additions,
          deletions: prResult.deletions,
          base: { ref: prResult.base_branch || 'main' },
          head: { ref: prResult.head_branch || 'feature' },
        };
        filesData = filesResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message: `Failed to fetch PR: ${message}` },
        });
      }

      const selectedFiles = files ? filesData.filter((f) => files.includes(f.filename)) : filesData;

      if (selectedFiles.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_FILES', message: 'No reviewable files found in this PR.' },
        });
      }

      let diffContent = selectedFiles
        .map((f) => `--- ${f.filename}\n+++ ${f.filename}\n${f.patch || '(binary file)'}`)
        .join('\n\n');

      let truncated = false;
      if (diffContent.length > MAX_DIFF_CHARS) {
        diffContent = diffContent.slice(0, MAX_DIFF_CHARS);
        truncated = true;
      }

      const language = detectLanguage(selectedFiles.map((f) => f.filename));

      const context = [
        `PR #${pull_number}: ${prData.title}`,
        prData.body ? `Description: ${prData.body}` : '',
        `Author: ${prData.user?.login}`,
        `Files changed: ${selectedFiles.length}`,
        `+${prData.additions || 0} -${prData.deletions || 0}`,
      ]
        .filter(Boolean)
        .join('\n');

      let rendered;
      try {
        rendered = registry.render('prompt_code_review', {
          language,
          code: diffContent,
          context,
          reviewType,
          reviewDepth,
          isQuick: reviewDepth === 'Quick' ? 'yes' : undefined,
          isStandard: reviewDepth === 'Standard' ? 'yes' : undefined,
          isDeep: reviewDepth === 'Deep' ? 'yes' : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'PROMPT_ERROR', message: `Failed to render prompt: ${message}` },
        });
      }

      const effectiveMaxTokens = DEPTH_MAX_TOKENS[reviewDepth] ?? 2048;

      try {
        const result = await aiService.generate(rendered.userPrompt, rendered.systemPrompt, {
          provider,
          model: (DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini) as never,
          maxTokens: effectiveMaxTokens,
        });

        const totalTokens = result.tokens.total || result.tokens.input + result.tokens.output;

        return reply.send({
          success: true,
          provider: result.provider,
          model: result.model,
          response: result.content,
          latencyMs: result.latencyMs,
          reviewDepth,
          truncated,
          pr: {
            number: pull_number,
            title: prData.title,
            url: prData.html_url,
            author: prData.user?.login,
            filesChanged: selectedFiles.length,
            additions: prData.additions || 0,
            deletions: prData.deletions || 0,
          },
          usage: {
            input: result.tokens.input,
            output: result.tokens.output,
            total: totalTokens,
          },
        });
      } catch (error) {
        app.log.error({ err: error, provider }, 'GitHub PR review failed');
        const errorResponse = classifyAIError(error);
        return reply.status(errorResponse.status).send({
          success: false,
          error: {
            code: errorResponse.code,
            message: errorResponse.message,
            retryable: errorResponse.retryable,
          },
        });
      }
    },
  );

  // POST /github/analyze
  app.post(
    '/github/analyze',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Comprehensive AI-powered PR analysis generating all report sections',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = analyzeSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { owner, repo, pull_number, provider } = parsed.data;

      let prData;
      let filesData;
      try {
        const [prResult, filesResult] = await Promise.all([
          repositoryIntelligenceService.getPullRequest(auth.sub, owner, repo, pull_number),
          repositoryIntelligenceService.getPullRequestFiles(auth.sub, owner, repo, pull_number),
        ]);

        if (!prResult) {
          return reply.status(404).send({
            success: false,
            error: { code: 'PR_NOT_FOUND', message: 'Pull request not found' },
          });
        }

        prData = {
          title: prResult.title,
          body: prResult.body,
          user: { login: prResult.user },
          html_url: prResult.html_url,
          additions: prResult.additions,
          deletions: prResult.deletions,
          base: { ref: prResult.base_branch || 'main' },
          head: { ref: prResult.head_branch || 'feature' },
        };
        filesData = filesResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message: `Failed to fetch PR: ${message}` },
        });
      }

      if (filesData.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_FILES', message: 'No files found in this PR.' },
        });
      }

      let diffContent = filesData
        .map((f) => `--- ${f.filename}\n+++ ${f.filename}\n${f.patch || '(binary file)'}`)
        .join('\n\n');

      let truncated = false;
      if (diffContent.length > MAX_DIFF_CHARS) {
        diffContent = diffContent.slice(0, MAX_DIFF_CHARS);
        truncated = true;
      }

      const filenames = filesData.map((f) => f.filename);
      const fileTypes = detectFileTypes(filenames);

      let rendered;
      try {
        rendered = registry.render('prompt_pr_assistant', {
          title: prData.title,
          body: prData.body || '(No description provided)',
          author: prData.user?.login || 'unknown',
          baseBranch: prData.base?.ref || 'main',
          headBranch: prData.head?.ref || 'feature',
          additions: String(prData.additions || 0),
          deletions: String(prData.deletions || 0),
          changedFiles: String(filesData.length),
          diff: diffContent,
          fileTypes,
          truncated: truncated ? 'yes' : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'PROMPT_ERROR', message: `Failed to render prompt: ${message}` },
        });
      }

      try {
        const result = await aiService.generate(rendered.userPrompt, rendered.systemPrompt, {
          provider,
          model: (DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini) as never,
          maxTokens: 4096,
        });

        const totalTokens = result.tokens.total || result.tokens.input + result.tokens.output;

        return reply.send({
          success: true,
          provider: result.provider,
          model: result.model,
          response: result.content,
          latencyMs: result.latencyMs,
          truncated,
          fileTypes,
          pr: {
            number: pull_number,
            title: prData.title,
            url: prData.html_url,
            author: prData.user?.login,
            filesChanged: filesData.length,
            additions: prData.additions || 0,
            deletions: prData.deletions || 0,
          },
          usage: {
            input: result.tokens.input,
            output: result.tokens.output,
            total: totalTokens,
          },
        });
      } catch (error) {
        app.log.error({ err: error, provider }, 'GitHub PR analyze failed');
        const errorResponse = classifyAIError(error);
        return reply.status(errorResponse.status).send({
          success: false,
          error: {
            code: errorResponse.code,
            message: errorResponse.message,
            retryable: errorResponse.retryable,
          },
        });
      }
    },
  );
}

export { analyzeSchema, detectFileTypes, detectLanguage };
