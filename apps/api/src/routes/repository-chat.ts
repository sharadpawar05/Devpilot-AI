import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { getOctokit } from '@/routes/github';
import { aiService } from '@/lib/ai';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.css',
  '.scss',
  '.html',
  '.env',
  '.env.example',
  '.gitignore',
  '.eslintrc',
  '.prettierrc',
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.git',
  'public',
  'assets',
  '__tests__',
  '__mocks__',
  '.turbo',
  '.cache',
]);

const MAX_FILE_SIZE = 50_000;
const MAX_CONTEXT_FILES = 15;
const MAX_TREE_DEPTH = 4;

interface RepoFile {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: RepoFile[];
  sha?: string;
  size?: number;
}

interface RepoIndex {
  tree: RepoFile[];
  keyFiles: Record<string, string>;
  readme: string;
  packageJson: Record<string, unknown> | null;
  totalFiles: number;
  indexedAt: string;
}

const repoIndexCache = new Map<string, RepoIndex>();

function buildRepoTree(
  items: Array<{ path: string; type: string; sha: string; size?: number }>,
  maxDepth = MAX_TREE_DEPTH,
): RepoFile[] {
  const root: RepoFile[] = [];
  const map = new Map<string, RepoFile>();

  const sorted = [...items].sort((a, b) => {
    const aDir = a.type === 'tree' ? 0 : 1;
    const bDir = b.type === 'tree' ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.path.localeCompare(b.path);
  });

  for (const item of sorted) {
    const parts = item.path.split('/');
    if (parts.length > maxDepth + 1) continue;

    const name = parts[parts.length - 1];
    const depth = parts.length - 1;

    if (depth > 0) {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = map.get(parentPath);
      if (!parent) continue;
    }

    const node: RepoFile = {
      path: item.path,
      name,
      type: item.type === 'tree' ? 'dir' : 'file',
      sha: item.sha,
      size: item.size,
    };

    if (node.type === 'dir') {
      node.children = [];
    }

    map.set(item.path, node);

    if (depth === 0) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = map.get(parentPath);
      if (parent?.children) {
        parent.children.push(node);
      }
    }
  }

  return root;
}

function isSupportedFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext) || SUPPORTED_CONFIG_FILES.has(filename);
}

const SUPPORTED_CONFIG_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  '.eslintrc.js',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'webpack.config.js',
  'rollup.config.js',
  '.env.example',
  '.env.local',
  'docker-compose.yml',
  'Dockerfile',
  'Makefile',
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
]);

function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name.startsWith('.');
}

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

function buildTreeSummary(tree: RepoFile[], prefix = ''): string {
  const lines: string[] = [];
  for (const node of tree) {
    const indent = prefix;
    if (node.type === 'dir') {
      lines.push(`${indent}${node.name}/`);
      if (node.children) {
        lines.push(buildTreeSummary(node.children, prefix + '  '));
      }
    } else {
      lines.push(`${indent}${node.name}`);
    }
  }
  return lines.join('\n');
}

function findFilesByKeywords(
  tree: RepoFile[],
  keywords: string[],
  results: string[] = [],
): string[] {
  for (const node of tree) {
    if (node.type === 'file') {
      const lowerName = node.name.toLowerCase();
      if (keywords.some((kw) => lowerName.includes(kw.toLowerCase()))) {
        results.push(node.path);
      }
    }
    if (node.children) {
      findFilesByKeywords(node.children, keywords, results);
    }
  }
  return results;
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
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = indexSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ success: false, error: { message: parsed.error.errors[0].message } });
      }

      const { owner, repo, branch } = parsed.data;
      const cacheKey = `${auth.sub}:${owner}/${repo}:${branch}`;

      if (repoIndexCache.has(cacheKey)) {
        return reply.send({ success: true, cached: true, ...repoIndexCache.get(cacheKey)! });
      }

      try {
        const octokit = await getOctokit(auth.sub);

        const { data: treeData } = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: branch,
          recursive: 'true',
        });

        const tree = buildRepoTree(
          treeData.tree as Array<{ path: string; type: string; sha: string; size?: number }>,
        );

        const supportedFiles = (
          treeData.tree as Array<{ path: string; type: string; size?: number }>
        )
          .filter((item) => item.type === 'blob' && isSupportedFile(item.path))
          .filter((item) => {
            const parts = item.path.split('/');
            return !parts.some((p) => shouldIgnoreDir(p));
          });

        const keyFilePatterns = [
          'readme',
          'package.json',
          'tsconfig',
          'vite.config',
          'tailwind.config',
          '.eslintrc',
          'dockerfile',
          'docker-compose',
          '.env.example',
          'contributing',
        ];

        const keyFilePaths = supportedFiles
          .filter((f) => keyFilePatterns.some((p) => f.path.toLowerCase().includes(p)))
          .slice(0, 10)
          .map((f) => f.path);

        const keyFiles: Record<string, string> = {};
        for (const filePath of keyFilePaths) {
          try {
            const { data: fileData } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: filePath,
              ref: branch,
            });
            if ('content' in fileData && fileData.content) {
              keyFiles[filePath] = Buffer.from(fileData.content, 'base64').toString('utf-8');
            }
          } catch {
            // Skip files that can't be read
          }
        }

        const readme = keyFiles['README.md'] || '';
        const packageJsonRaw = keyFiles['package.json'] || '';
        let packageJson: Record<string, unknown> | null = null;
        try {
          packageJson = JSON.parse(packageJsonRaw);
        } catch {
          // ignore
        }

        const index: RepoIndex = {
          tree,
          keyFiles,
          readme,
          packageJson,
          totalFiles: supportedFiles.length,
          indexedAt: new Date().toISOString(),
        };

        repoIndexCache.set(cacheKey, index);

        return reply.send({ success: true, cached: false, ...index });
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
        return reply
          .status(500)
          .send({
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

      const cacheKey = `${auth.sub}:${owner}/${repo}:${branch}`;
      const index = repoIndexCache.get(cacheKey);

      if (!index) {
        return reply
          .status(404)
          .send({
            success: false,
            error: { message: 'Repository not indexed. Please index it first.' },
          });
      }

      return reply.send({
        success: true,
        tree: index.tree,
        totalFiles: index.totalFiles,
        indexedAt: index.indexedAt,
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
      const cacheKey = `${auth.sub}:${owner}/${repo}:${branch}`;

      const index = repoIndexCache.get(cacheKey);
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
        if (index.keyFiles[filePath]) {
          fileContents[filePath] = index.keyFiles[filePath];
          continue;
        }
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
      const keyFilesContext = buildKeyFilesContext(index.keyFiles);
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

      const cacheKey = `${auth.sub}:${owner}/${repo}:${branch}`;
      const index = repoIndexCache.get(cacheKey);

      return reply.send({
        success: true,
        indexed: !!index,
        totalFiles: index?.totalFiles ?? 0,
        indexedAt: index?.indexedAt ?? null,
      });
    },
  );
}
