import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Octokit } from 'octokit';
import { authenticate } from '@/middleware/auth';
import { getEnv } from '@/config';
import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';
import { aiService } from '@/lib/ai';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

async function getGitHubToken(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { supabaseUserId: userId },
    select: { githubAccessToken: true },
  });
  if (!user?.githubAccessToken) return null;
  try {
    return decrypt(user.githubAccessToken);
  } catch {
    // Token might be plaintext (stored before encryption was added)
    // Check if it looks like a valid GitHub token (gho_, ghp_, or github_pat_)
    if (
      user.githubAccessToken.startsWith('gho_') ||
      user.githubAccessToken.startsWith('ghp_') ||
      user.githubAccessToken.startsWith('github_pat_')
    ) {
      return user.githubAccessToken;
    }
    return null;
  }
}

async function setGitHubToken(
  userId: string,
  token: string,
  email?: string,
  name?: string,
): Promise<void> {
  const encryptedToken = encrypt(token);
  await db.user.upsert({
    where: { supabaseUserId: userId },
    update: { githubAccessToken: encryptedToken },
    create: {
      supabaseUserId: userId,
      email: email || `${userId}@placeholder.local`,
      fullName: name || 'GitHub User',
      githubAccessToken: encryptedToken,
    },
  });
}

async function deleteGitHubToken(userId: string): Promise<void> {
  await db.user.update({
    where: { supabaseUserId: userId },
    data: { githubAccessToken: null },
  });
}

async function getOctokit(userId: string): Promise<Octokit> {
  const token = await getGitHubToken(userId);
  if (!token) {
    throw new Error('GitHub not connected. Please connect your GitHub account first.');
  }
  return new Octokit({ auth: token });
}

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

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-flash-latest',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
};

const DEPTH_MAX_TOKENS: Record<string, number> = {
  Quick: 1024,
  Standard: 2048,
  Deep: 4096,
};

const MAX_DIFF_CHARS = 100_000; // ~25k tokens

export async function githubRoutes(app: FastifyInstance) {
  // GET /github/auth-url - Get GitHub OAuth URL
  app.get(
    '/github/auth-url',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get GitHub OAuth authorization URL',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const env = getEnv();
      if (!env.GITHUB_CLIENT_ID) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message:
              'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file.',
          },
        });
      }

      const state = crypto.randomUUID();
      const auth = _request as { auth: { sub: string } };

      // Store state in HTTP-only cookie (10 min expiry)
      reply.setCookie('github_oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600, // 10 minutes
        sameSite: 'lax',
      });

      // Also store userId in a separate cookie for callback
      reply.setCookie('github_oauth_user', auth.auth.sub, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        sameSite: 'lax',
      });

      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: env.GITHUB_REDIRECT_URI,
        scope: 'read:user user:email repo',
        state,
      });

      return reply.send({
        success: true,
        url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      });
    },
  );

  // GET /github/callback - Exchange code for token
  app.get(
    '/github/callback',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Exchange GitHub OAuth code for access token',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['code', 'state'],
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = (
        request as {
          auth: { sub: string; email?: string; user_metadata?: Record<string, unknown> };
        }
      ).auth;
      const { code, state } = request.query as { code: string; state: string };

      if (!code || !state) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'Authorization code and state are required' },
        });
      }

      // Validate state from signed cookie (CSRF protection)
      const expectedState = request.cookies?.github_oauth_state;

      // Clear the cookies
      reply.clearCookie('github_oauth_state', { path: '/' });
      reply.clearCookie('github_oauth_user', { path: '/' });

      if (!expectedState || expectedState !== state) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'Invalid or expired OAuth state. Please try again.',
          },
        });
      }

      const env = getEnv();
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'GitHub OAuth is not configured.',
          },
        });
      }

      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const data = (await response.json()) as {
          access_token?: string;
          error?: string;
          error_description?: string;
        };

        if (data.error || !data.access_token) {
          app.log.error({ github_error: data }, 'GitHub OAuth token exchange failed');
          return reply.status(400).send({
            success: false,
            error: {
              code: 'OAUTH_ERROR',
              message:
                data.error_description ||
                data.error ||
                'Failed to exchange code for token. Ensure your GitHub OAuth App callback URL matches the redirect URI.',
            },
          });
        }

        await setGitHubToken(
          auth.sub,
          data.access_token,
          auth.email,
          auth.user_metadata?.full_name as string | undefined,
        );

        const octokit = new Octokit({ auth: data.access_token });
        const { data: ghUser } = await octokit.rest.users.getAuthenticated();

        return reply.send({
          success: true,
          user: {
            login: ghUser.login,
            avatar_url: ghUser.avatar_url,
            name: ghUser.name,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.log.error({ err: error }, 'GitHub OAuth callback failed');
        return reply.status(500).send({
          success: false,
          error: { code: 'OAUTH_ERROR', message },
        });
      }
    },
  );

  // GET /github/account - Get connected GitHub account
  app.get(
    '/github/account',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get connected GitHub account info',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const token = await getGitHubToken(auth.sub);

      if (!token) {
        return reply.send({ success: true, connected: false });
      }

      try {
        const octokit = new Octokit({ auth: token });
        const { data: user } = await octokit.rest.users.getAuthenticated();
        return reply.send({
          success: true,
          connected: true,
          user: {
            login: user.login,
            avatar_url: user.avatar_url,
            name: user.name,
          },
        });
      } catch (error) {
        // Only delete token if it's definitively invalid (401 Unauthorized)
        const isAuthError =
          error &&
          typeof error === 'object' &&
          'status' in error &&
          (error as { status: number }).status === 401;
        if (isAuthError) {
          await deleteGitHubToken(auth.sub);
        }
        return reply.send({ success: true, connected: false });
      }
    },
  );

  // DELETE /github/disconnect - Disconnect GitHub
  app.delete(
    '/github/disconnect',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Disconnect GitHub account',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      await deleteGitHubToken(auth.sub);
      return reply.send({ success: true });
    },
  );

  // GET /github/repositories - List user repositories
  app.get(
    '/github/repositories',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List authenticated user GitHub repositories',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      try {
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 100,
        });
        return reply.send({
          success: true,
          repositories: data.map((r) => ({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            private: r.private,
            description: r.description,
            language: r.language,
            updated_at: r.updated_at,
            html_url: r.html_url,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message },
        });
      }
    },
  );

  // GET /github/repositories/:owner/:repo/branches - List branches
  app.get(
    '/github/repositories/:owner/:repo/branches',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List repository branches',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo } = request.params as { owner: string; repo: string };
      try {
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: 100,
        });
        return reply.send({
          success: true,
          branches: data.map((b) => ({
            name: b.name,
            is_default: b.name === 'main' || b.name === 'master',
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message },
        });
      }
    },
  );

  // GET /github/repositories/:owner/:repo/pulls - List pull requests
  app.get(
    '/github/repositories/:owner/:repo/pulls',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List repository pull requests',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo } = request.params as { owner: string; repo: string };
      try {
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: 50,
        });
        return reply.send({
          success: true,
          pulls: data.map((p) => ({
            number: p.number,
            title: p.title,
            body: p.body,
            state: p.state,
            user: p.user?.login,
            created_at: p.created_at,
            updated_at: p.updated_at,
            html_url: p.html_url,
            additions: (p as Record<string, unknown>).additions ?? 0,
            deletions: (p as Record<string, unknown>).deletions ?? 0,
            changed_files: (p as Record<string, unknown>).changed_files ?? 0,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message },
        });
      }
    },
  );

  // GET /github/pulls/:owner/:repo/:pull_number/files - List changed files
  app.get(
    '/github/pulls/:owner/:repo/:pull_number/files',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List files changed in a pull request',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['owner', 'repo', 'pull_number'],
          properties: {
            owner: { type: 'string', minLength: 1 },
            repo: { type: 'string', minLength: 1 },
            pull_number: { type: 'string', pattern: '^[1-9]\\d*$' },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { owner, repo, pull_number } = request.params as {
        owner: string;
        repo: string;
        pull_number: string;
      };
      const pullNumber = parseInt(pull_number, 10);
      if (isNaN(pullNumber) || pullNumber < 1) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid pull request number' },
        });
      }
      try {
        const octokit = await getOctokit(auth.sub);
        const { data } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        });
        return reply.send({
          success: true,
          files: data.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
            patch: f.patch,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message },
        });
      }
    },
  );

  // POST /github/review - Review a PR using AI
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

      let octokit: Octokit;
      try {
        octokit = await getOctokit(auth.sub);
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_CONNECTED', message: (error as Error).message },
        });
      }

      let prData;
      let filesData;
      try {
        const [prResp, filesResp] = await Promise.all([
          octokit.rest.pulls.get({ owner, repo, pull_number }),
          octokit.rest.pulls.listFiles({ owner, repo, pull_number, per_page: 100 }),
        ]);
        prData = prResp.data;
        filesData = filesResp.data;
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
        const message = error instanceof Error ? error.message : String(error);
        const code_ =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'AI_ERROR';

        app.log.error({ err: error, provider }, 'GitHub PR review failed');

        return reply.status(502).send({
          success: false,
          error: { code: code_, message },
        });
      }
    },
  );
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
