import type { FastifyInstance } from 'fastify';
import { Octokit } from 'octokit';
import { authenticate } from '@/core/auth';
import { getEnv } from '@/config';
import { db } from '@/core/db';
import {
  getGitHubToken,
  setGitHubToken,
  deleteGitHubToken,
  getOctokit,
  revokeGitHubToken,
} from '@/core/github/token';

export async function githubRoutes(app: FastifyInstance) {
  // GET /github/auth-url
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

      reply.setCookie('github_oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: true,
        signed: true,
        maxAge: 600,
        sameSite: 'none',
      });

      reply.setCookie('github_oauth_user', auth.auth.sub, {
        path: '/',
        httpOnly: true,
        secure: true,
        signed: true,
        maxAge: 600,
        sameSite: 'none',
      });

      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: env.GITHUB_REDIRECT_URI,
        // security_events: required for the Dependabot alerts API used by health checks
        scope: 'read:user user:email repo security_events',
        state,
      });

      return reply.send({
        success: true,
        url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      });
    },
  );

  // GET /github/status
  app.get(
    '/github/status',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Check GitHub connection status without calling GitHub API',
        tags: ['github'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: {
          githubAccessToken: true,
          githubUserId: true,
          githubUsername: true,
          githubAvatar: true,
          githubConnectedAt: true,
        },
      });

      if (!user?.githubAccessToken) {
        return reply.send({ success: true, connected: false });
      }

      return reply.send({
        success: true,
        connected: true,
        user: {
          id: user.githubUserId,
          login: user.githubUsername,
          avatar_url: user.githubAvatar,
        },
        connectedAt: user.githubConnectedAt?.toISOString() ?? null,
      });
    },
  );

  // GET /github/callback
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

      const rawState = request.cookies?.github_oauth_state;
      const expectedState = rawState ? request.unsignCookie(rawState).value : undefined;

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
          // Never log a token, even on the failure path.
          const safeError: typeof data = { ...data };
          delete safeError.access_token;
          app.log.error({ github_error: safeError }, 'GitHub OAuth token exchange failed');
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

        const octokit = new Octokit({ auth: data.access_token });
        const { data: ghUser } = await octokit.rest.users.getAuthenticated();

        await setGitHubToken(
          auth.sub,
          data.access_token,
          auth.email,
          auth.user_metadata?.full_name as string | undefined,
          { id: ghUser.id, login: ghUser.login, avatar_url: ghUser.avatar_url },
        );

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

  // GET /github/account
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
      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: {
          githubAccessToken: true,
          githubUserId: true,
          githubUsername: true,
          githubAvatar: true,
          githubConnectedAt: true,
        },
      });

      if (!user?.githubAccessToken) {
        return reply.send({ success: true, connected: false });
      }

      if (user.githubUsername && user.githubAvatar) {
        return reply.send({
          success: true,
          connected: true,
          user: {
            login: user.githubUsername,
            avatar_url: user.githubAvatar,
            id: user.githubUserId,
          },
          connectedAt: user.githubConnectedAt?.toISOString() ?? null,
        });
      }

      try {
        const token = await getGitHubToken(auth.sub);
        if (!token) {
          return reply.send({ success: true, connected: false });
        }
        const octokit = new Octokit({ auth: token });
        const { data: ghUser } = await octokit.rest.users.getAuthenticated();

        await db.user.update({
          where: { supabaseUserId: auth.sub },
          data: {
            githubUserId: ghUser.id,
            githubUsername: ghUser.login,
            githubAvatar: ghUser.avatar_url,
            githubConnectedAt: user.githubConnectedAt ?? new Date(),
          },
        });

        return reply.send({
          success: true,
          connected: true,
          user: {
            login: ghUser.login,
            avatar_url: ghUser.avatar_url,
            id: ghUser.id,
          },
          connectedAt: (user.githubConnectedAt ?? new Date()).toISOString(),
        });
      } catch (error) {
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

  // DELETE /github/disconnect
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
      const token = await getGitHubToken(auth.sub);
      if (token) {
        await revokeGitHubToken(token);
      }
      await deleteGitHubToken(auth.sub);
      return reply.send({ success: true });
    },
  );

  // GET /github/repositories
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
            stargazers_count: r.stargazers_count,
            forks_count: r.forks_count,
            size: r.size,
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

  // GET /github/repositories/:owner/:repo/branches
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
        console.error(`[GitHub] branches error for ${owner}/${repo}:`, message);
        return reply.status(500).send({
          success: false,
          error: { code: 'GITHUB_ERROR', message },
        });
      }
    },
  );

  // GET /github/repositories/:owner/:repo/pulls
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

  // GET /github/pulls/:owner/:repo/:pull_number/files
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
}
