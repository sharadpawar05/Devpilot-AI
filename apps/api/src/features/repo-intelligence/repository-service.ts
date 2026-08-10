import { getOctokit } from '@/core/github';
import { db } from '@/core/db';
import type {
  RepositoryMetadata,
  RepositoryStatistics,
  Contributor,
  Branch,
  PullRequest,
  PullRequestFile,
  Commit,
  Release,
  Issue,
  ActivityEvent,
  CommitActivity,
  RepositoryHealth,
  RepositoryIntelligence,
  FileTreeNode,
  FileContent,
  HealthCheckDetail,
  ScoreBreakdownItem,
  DetectedTechnology,
  ImportantFile,
  FolderNode,
  ProjectType,
  PackageManager,
} from './types';
import { analyzeComplexity } from './complexity-analyzer';
import { analyzeHotspots } from './hotspot-analyzer';
import { analyzeDebt } from './debt-analyzer';

// ─── Cache Configuration ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STATS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for expensive stats
const TREE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes for trees

// ─── Health Check Constants ──────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
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

const IMPORTANT_FILES_PATTERNS: { pattern: RegExp; purpose: string }[] = [
  { pattern: /^package\.json$/, purpose: 'Package manifest' },
  { pattern: /^pnpm-lock\.yaml$/, purpose: 'PNPM lockfile' },
  { pattern: /^yarn\.lock$/, purpose: 'Yarn lockfile' },
  { pattern: /^package-lock\.json$/, purpose: 'NPM lockfile' },
  { pattern: /^bun\.lockb?$/, purpose: 'Bun lockfile' },
  { pattern: /^tsconfig\.json$/, purpose: 'TypeScript config' },
  { pattern: /^vite\.config\.(ts|js|mjs|mts)$/, purpose: 'Vite config' },
  { pattern: /^next\.config\.(ts|js|mjs)$/, purpose: 'Next.js config' },
  { pattern: /^nuxt\.config\.(ts|js|mjs)$/, purpose: 'Nuxt config' },
  { pattern: /^angular\.json$/, purpose: 'Angular config' },
  { pattern: /^svelte\.config\.(ts|js)$/, purpose: 'Svelte config' },
  { pattern: /^astro\.config\.(ts|js|mjs)$/, purpose: 'Astro config' },
  { pattern: /^remix\.config\.(ts|js|mjs)$/, purpose: 'Remix config' },
  { pattern: /^webpack\.config\.(ts|js|mjs)$/, purpose: 'Webpack config' },
  { pattern: /^rollup\.config\.(ts|js|mjs)$/, purpose: 'Rollup config' },
  { pattern: /^turbo\.json$/, purpose: 'Turborepo config' },
  { pattern: /^nx\.json$/, purpose: 'Nx config' },
  { pattern: /^lerna\.json$/, purpose: 'Lerna config' },
  { pattern: /^pnpm-workspace\.yaml$/, purpose: 'PNPM workspace config' },
  { pattern: /^\.eslintrc\.(js|cjs|mjs|json|yaml|yml)$/, purpose: 'ESLint config' },
  { pattern: /^eslint\.config\.(js|cjs|mjs|ts)$/, purpose: 'ESLint flat config' },
  { pattern: /^\.prettierrc\.(js|cjs|mjs|json|yaml|yml)$/, purpose: 'Prettier config' },
  { pattern: /^prettier\.config\.(js|cjs|mts)$/, purpose: 'Prettier config' },
  { pattern: /^biome\.json$/, purpose: 'Biome config' },
  { pattern: /^jest\.config\.(ts|js|mjs|cjs)$/, purpose: 'Jest config' },
  { pattern: /^vitest\.config\.(ts|js|mjs)$/, purpose: 'Vitest config' },
  { pattern: /^cypress\.config\.(ts|js)$/, purpose: 'Cypress config' },
  { pattern: /^playwright\.config\.(ts|js)$/, purpose: 'Playwright config' },
  { pattern: /^Dockerfile$/, purpose: 'Dockerfile' },
  { pattern: /^docker-compose\.(ya?ml|json)$/, purpose: 'Docker Compose' },
  { pattern: /^\.dockerignore$/, purpose: 'Docker ignore' },
  { pattern: /^\.env$/, purpose: 'Environment variables' },
  { pattern: /^\.env\.example$/, purpose: 'Environment variables (example)' },
  { pattern: /^README\.md$/, purpose: 'README' },
  { pattern: /^LICENSE$/, purpose: 'License' },
  { pattern: /^LICENSE\.\w+$/, purpose: 'License' },
  { pattern: /^\.gitignore$/, purpose: 'Git ignore' },
  { pattern: /^\.github\/workflows\/.+\.ya?ml$/, purpose: 'GitHub Actions workflow' },
  { pattern: /^prisma\/schema\.prisma$/, purpose: 'Prisma schema' },
  { pattern: /^drizzle\.config\.(ts|js)$/, purpose: 'Drizzle config' },
  { pattern: /^tailwind\.config\.(ts|js|cjs|mjs)$/, purpose: 'Tailwind config' },
  { pattern: /^postcss\.config\.(ts|js|cjs|mjs)$/, purpose: 'PostCSS config' },
  { pattern: /^supabase\/config\.toml$/, purpose: 'Supabase config' },
];

// ─── Cache Key Helpers ───────────────────────────────────────────────────────

function cacheKey(parts: string[]): string {
  return parts.join('::');
}

// ─── Repository Intelligence Service ─────────────────────────────────────────

export class RepositoryIntelligenceService {
  private cache = new Map<string, CacheEntry<unknown>>();

  // ─── Cache Management ────────────────────────────────────────────────────

  private get<T>(key: string, ttl: number = DEFAULT_CACHE_TTL): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(owner: string, repo: string): void {
    const prefix = `${owner}/${repo}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ─── Core GitHub Data Fetching ───────────────────────────────────────────

  async getMetadata(userId: string, owner: string, repo: string): Promise<RepositoryMetadata> {
    const key = cacheKey([owner, repo, 'metadata']);
    const cached = this.get<RepositoryMetadata>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.repos.get({ owner, repo });

    const metadata: RepositoryMetadata = {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      html_url: data.html_url,
      default_branch: data.default_branch,
      visibility: data.visibility as 'public' | 'private',
      size: data.size,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      watchers_count: data.watchers_count,
      language: data.language,
      license: data.license
        ? { spdx_id: data.license.spdx_id || '', name: data.license.name || '' }
        : null,
      topics: data.topics || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      pushed_at: data.pushed_at,
      owner: {
        login: data.owner.login,
        avatar_url: data.owner.avatar_url || '',
      },
    };

    this.set(key, metadata);
    return metadata;
  }

  async getDefaultBranch(userId: string, owner: string, repo: string): Promise<string> {
    const metadata = await this.getMetadata(userId, owner, repo);
    return metadata.default_branch;
  }

  // ─── File Tree ───────────────────────────────────────────────────────────

  async getFileTree(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<FileTreeNode[]> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const key = cacheKey([owner, repo, 'tree', resolvedBranch]);
    const cached = this.get<FileTreeNode[]>(key, TREE_CACHE_TTL);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: resolvedBranch,
      recursive: 'true',
    });

    const tree = this.buildFileTree(
      (treeData.tree as Array<{ path: string; type: string; size?: number }>).filter(
        (item) => !IGNORED_DIRS.has(item.path.split('/')[0]),
      ),
    );

    this.set(key, tree);
    return tree;
  }

  async getFlatFilePaths(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<string[]> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const key = cacheKey([owner, repo, 'flatPaths', resolvedBranch]);
    const cached = this.get<string[]>(key, TREE_CACHE_TTL);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: resolvedBranch,
      recursive: 'true',
    });

    const paths = (treeData.tree as Array<{ path: string; type: string }>)
      .filter((e) => e.type === 'blob')
      .map((e) => e.path);

    this.set(key, paths);
    return paths;
  }

  // ─── File Content ────────────────────────────────────────────────────────

  async getFileContent(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ): Promise<FileContent | null> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const key = cacheKey([owner, repo, 'file', resolvedBranch, path]);
    const cached = this.get<FileContent | null>(key);
    if (cached !== null) return cached;

    try {
      const octokit = await getOctokit(userId);
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: resolvedBranch,
      });

      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const result: FileContent = {
          name: data.name,
          path: data.path,
          content,
          size: data.size,
        };
        this.set(key, result);
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getFileContents(
    userId: string,
    owner: string,
    repo: string,
    paths: string[],
    branch?: string,
  ): Promise<Map<string, string>> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const results = new Map<string, string>();

    await Promise.all(
      paths.map(async (path) => {
        const content = await this.getFileContent(userId, owner, repo, path, resolvedBranch);
        if (content) {
          results.set(path, content.content);
        }
      }),
    );

    return results;
  }

  // ─── Languages ───────────────────────────────────────────────────────────

  async getLanguages(userId: string, owner: string, repo: string): Promise<Record<string, number>> {
    const key = cacheKey([owner, repo, 'languages']);
    const cached = this.get<Record<string, number>>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.repos.listLanguages({ owner, repo });
    this.set(key, data);
    return data;
  }

  // ─── Contributors ────────────────────────────────────────────────────────

  async getContributors(
    userId: string,
    owner: string,
    repo: string,
    perPage: number = 20,
  ): Promise<Contributor[]> {
    const key = cacheKey([owner, repo, 'contributors', String(perPage)]);
    const cached = this.get<Contributor[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: perPage,
    });

    const contributors: Contributor[] = data.map((c) => ({
      login: c.login || '',
      avatar_url: c.avatar_url || '',
      contributions: c.contributions,
      html_url: c.html_url || '',
    }));

    this.set(key, contributors);
    return contributors;
  }

  // ─── Branches ────────────────────────────────────────────────────────────

  async getBranches(userId: string, owner: string, repo: string): Promise<Branch[]> {
    const key = cacheKey([owner, repo, 'branches']);
    const cached = this.get<Branch[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const metadata = await this.getMetadata(userId, owner, repo);
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    const branches: Branch[] = data.map((b) => ({
      name: b.name,
      is_default: b.name === metadata.default_branch,
      commit_sha: b.commit.sha,
    }));

    this.set(key, branches);
    return branches;
  }

  // ─── Pull Requests ───────────────────────────────────────────────────────

  async getPullRequests(
    userId: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    perPage: number = 50,
  ): Promise<PullRequest[]> {
    const key = cacheKey([owner, repo, 'pulls', state, String(perPage)]);
    const cached = this.get<PullRequest[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state,
      per_page: perPage,
    });

    const pulls: PullRequest[] = data.map((p) => ({
      number: p.number,
      title: p.title,
      body: p.body ?? null,
      state: p.state,
      user: p.user?.login || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      html_url: p.html_url,
      additions: Number((p as Record<string, unknown>).additions) || 0,
      deletions: Number((p as Record<string, unknown>).deletions) || 0,
      changed_files: Number((p as Record<string, unknown>).changed_files) || 0,
      base_branch: p.base?.ref,
      head_branch: p.head?.ref,
      merged: Boolean((p as Record<string, unknown>).merged),
    }));

    this.set(key, pulls);
    return pulls;
  }

  async getPullRequest(
    userId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequest | null> {
    const key = cacheKey([owner, repo, 'pr', String(pullNumber)]);
    const cached = this.get<PullRequest | null>(key);
    if (cached !== null) return cached;

    try {
      const octokit = await getOctokit(userId);
      const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });

      const pr: PullRequest = {
        number: data.number,
        title: data.title,
        body: data.body ?? null,
        state: data.state,
        user: data.user?.login || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        additions: Number((data as Record<string, unknown>).additions) || 0,
        deletions: Number((data as Record<string, unknown>).deletions) || 0,
        changed_files: Number((data as Record<string, unknown>).changed_files) || 0,
        base_branch: data.base?.ref,
        head_branch: data.head?.ref,
        merged: Boolean((data as Record<string, unknown>).merged),
      };

      this.set(key, pr);
      return pr;
    } catch {
      return null;
    }
  }

  async getPullRequestFiles(
    userId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestFile[]> {
    const key = cacheKey([owner, repo, 'prFiles', String(pullNumber)]);
    const cached = this.get<PullRequestFile[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    const files: PullRequestFile[] = data.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    }));

    this.set(key, files);
    return files;
  }

  // ─── Commits ─────────────────────────────────────────────────────────────

  async getCommits(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
    perPage: number = 30,
  ): Promise<Commit[]> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const key = cacheKey([owner, repo, 'commits', resolvedBranch, String(perPage)]);
    const cached = this.get<Commit[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: resolvedBranch,
      per_page: perPage,
    });

    const commits: Commit[] = data.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || null,
      author_date: c.commit.author?.date || '',
      html_url: c.html_url,
      additions: (c as Record<string, unknown>).stats
        ? ((c as Record<string, unknown>).stats as { additions?: number }).additions
        : undefined,
      deletions: (c as Record<string, unknown>).stats
        ? ((c as Record<string, unknown>).stats as { deletions?: number }).deletions
        : undefined,
    }));

    this.set(key, commits);
    return commits;
  }

  // ─── Releases ────────────────────────────────────────────────────────────

  async getReleases(
    userId: string,
    owner: string,
    repo: string,
    perPage: number = 30,
  ): Promise<Release[]> {
    const key = cacheKey([owner, repo, 'releases', String(perPage)]);
    const cached = this.get<Release[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: perPage,
    });

    const releases: Release[] = data.map((r) => ({
      id: r.id,
      tag_name: r.tag_name,
      name: r.name ?? null,
      body: r.body ?? null,
      draft: r.draft,
      prerelease: r.prerelease,
      created_at: r.created_at,
      published_at: r.published_at ?? null,
      author: r.author?.login || null,
      html_url: r.html_url,
    }));

    this.set(key, releases);
    return releases;
  }

  // ─── Issues ──────────────────────────────────────────────────────────────

  async getIssues(
    userId: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    perPage: number = 30,
  ): Promise<Issue[]> {
    const key = cacheKey([owner, repo, 'issues', state, String(perPage)]);
    const cached = this.get<Issue[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: perPage,
    });

    const issues: Issue[] = data
      .filter((i) => !i.pull_request) // Exclude pull requests
      .map((i) => ({
        number: i.number,
        title: i.title,
        body: i.body ?? null,
        state: i.state,
        user: i.user?.login || null,
        created_at: i.created_at,
        updated_at: i.updated_at,
        html_url: i.html_url,
        labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        assignees: (i.assignees || []).map((a) => a?.login || ''),
      }));

    this.set(key, issues);
    return issues;
  }

  // ─── Recent Activity ─────────────────────────────────────────────────────

  async getRecentActivity(
    userId: string,
    owner: string,
    repo: string,
    perPage: number = 30,
  ): Promise<ActivityEvent[]> {
    const key = cacheKey([owner, repo, 'activity', String(perPage)]);
    const cached = this.get<ActivityEvent[]>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);
    const { data } = await octokit.rest.activity.listRepoEvents({
      owner,
      repo,
      per_page: perPage,
    });

    const events: ActivityEvent[] = data.map((e) => ({
      id: String(e.id),
      type: e.type || 'unknown',
      actor: e.actor?.login || 'unknown',
      created_at: e.created_at || new Date().toISOString(),
      repo: `${owner}/${repo}`,
      payload: (e.payload || {}) as Record<string, unknown>,
    }));

    this.set(key, events);
    return events;
  }

  // ─── Commit Activity ─────────────────────────────────────────────────────

  async getCommitActivity(userId: string, owner: string, repo: string): Promise<CommitActivity[]> {
    const key = cacheKey([owner, repo, 'commitActivity']);
    const cached = this.get<CommitActivity[]>(key);
    if (cached) return cached;

    try {
      const octokit = await getOctokit(userId);
      const { data } = await octokit.rest.repos.getCommitActivityStats({ owner, repo });

      // GitHub returns 202 when computing, retry after delay
      if (Array.isArray(data)) {
        const activity: CommitActivity[] = data.map((w) => ({
          week: new Date(w.week * 1000).toISOString(),
          total: w.total,
          days: w.days,
        }));
        this.set(key, activity);
        return activity;
      }
      return [];
    } catch {
      return [];
    }
  }

  // ─── Repository Health ───────────────────────────────────────────────────

  async getHealth(userId: string, owner: string, repo: string): Promise<RepositoryHealth> {
    const key = cacheKey([owner, repo, 'health']);
    const cached = this.get<RepositoryHealth>(key);
    if (cached) return cached;

    const filePaths = await this.getFlatFilePaths(userId, owner, repo);
    const fileNames = filePaths.map((f) => f.split('/').pop() || '');
    const flatNames = fileNames.map((f) => f.toLowerCase());

    // Structural checks (file existence)
    const hasReadme = flatNames.some(
      (n) => n === 'readme.md' || n === 'readme.rst' || n === 'readme.txt',
    );
    const hasLicense = flatNames.some(
      (n) => n === 'license' || n === 'license.md' || n === 'license.txt',
    );
    const hasPackageJson = flatNames.includes('package.json');
    const hasDockerfile =
      flatNames.includes('dockerfile') ||
      flatNames.includes('docker-compose.yml') ||
      flatNames.includes('docker-compose.yaml');
    const hasEnvExample = flatNames.some(
      (n) => n === '.env.example' || n === '.env.sample' || n === '.env.template',
    );
    const hasGitignore = flatNames.includes('.gitignore');
    const hasDocumentation = filePaths.some(
      (p) => p.startsWith('docs/') || p === 'CONTRIBUTING.md' || p === 'CHANGELOG.md',
    );

    // Fetch file contents for quality analysis
    const readmePath = filePaths.find(
      (p) => p.toLowerCase() === 'readme.md' || p.toLowerCase() === 'readme.rst',
    );
    const coveragePaths = filePaths.filter(
      (p) => p.includes('coverage-summary.json') || p.includes('lcov.info'),
    );
    const workflowPaths = filePaths.filter(
      (p) => p.startsWith('.github/workflows/') && (p.endsWith('.yml') || p.endsWith('.yaml')),
    );
    const packageJsonPath = filePaths.find((p) => p === 'package.json');
    const lockfilePaths = filePaths.filter(
      (p) =>
        p === 'package-lock.json' ||
        p === 'yarn.lock' ||
        p === 'pnpm-lock.yaml' ||
        p === 'bun.lock',
    );

    // Fetch contents in parallel
    const [readmeContent, coverageContent, ...workflowContents] = await Promise.all([
      readmePath ? this.getFileContent(userId, owner, repo, readmePath) : Promise.resolve(null),
      coveragePaths.length > 0
        ? this.getFileContent(userId, owner, repo, coveragePaths[0])
        : Promise.resolve(null),
      ...workflowPaths.map((p) => this.getFileContent(userId, owner, repo, p)),
    ]);

    // Analyze test coverage
    const testCoverage = this.analyzeTestCoverage(coverageContent?.content, filePaths);

    // Analyze README quality
    const readmeQuality = this.analyzeReadmeQuality(readmeContent?.content);

    // Analyze CI/CD workflows
    const cicdQuality = this.analyzeCicdWorkflows(
      workflowContents.map((c) => c?.content).filter(Boolean) as string[],
      workflowPaths,
    );

    // Analyze dependencies
    const dependencyQuality = await this.analyzeDependencies(
      userId,
      owner,
      repo,
      packageJsonPath,
      lockfilePaths,
    );

    // Analyze security
    const securityQuality = await this.analyzeSecurity(userId, owner, repo, filePaths);

    // Fetch source file contents for complexity/debt analysis (limited sample)
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java'];
    const sourceFilePaths = filePaths
      .filter((p) => sourceExtensions.some((ext) => p.endsWith(ext)))
      .filter((p) => !p.includes('node_modules') && !p.includes('dist') && !p.includes('.min.'))
      .slice(0, 50);

    const fileContentsMap = new Map<string, string>();
    const contentResults = await Promise.allSettled(
      sourceFilePaths.map((p) => this.getFileContent(userId, owner, repo, p)),
    );
    for (let i = 0; i < sourceFilePaths.length; i++) {
      const result = contentResults[i];
      if (result.status === 'fulfilled' && result.value?.content) {
        fileContentsMap.set(sourceFilePaths[i], result.value.content);
      }
    }

    // Analyze complexity
    const complexityResult = analyzeComplexity(filePaths, fileContentsMap);

    // Analyze technical debt
    const debtResult = analyzeDebt(filePaths, fileContentsMap);

    // Analyze hotspots using file size and complexity as proxies for churn risk
    let hotspotResult: {
      hotspots: Array<{
        path: string;
        changeFrequency: number;
        sizeBytes: number;
        churnScore: number;
      }>;
      hotspotCount: number;
    } = { hotspots: [], hotspotCount: 0 };

    // Use file sizes from content map as the basis for hotspot detection
    const fileSizes = new Map<string, number>();
    for (const [fp, content] of fileContentsMap) {
      fileSizes.set(fp, content.length);
    }

    // Estimate change frequency from file characteristics:
    // - Files with many imports/exports tend to change more
    // - Configuration files change frequently
    // - Large files tend to be modified more often
    const fileChangeMap = new Map<string, number>();
    for (const [fp, content] of fileContentsMap) {
      const importCount = (content.match(/^import\s/gm) || []).length;
      const exportCount = (content.match(/^export\s/gm) || []).length;
      const lines = (content.match(/\n/g) || []).length;

      // Heuristic: files with more imports/exports and more lines tend to have higher change frequency
      let estimatedFreq = Math.max(1, Math.floor((importCount + exportCount) * 0.5 + lines * 0.01));
      estimatedFreq = Math.min(estimatedFreq, 20); // cap at 20

      fileChangeMap.set(fp, estimatedFreq);
    }

    hotspotResult = analyzeHotspots(
      Array.from(fileChangeMap.entries()).map(([file, count]) => ({ file, count })),
      fileSizes,
    );

    // Build health check details
    const details: HealthCheckDetail[] = [
      // Structural checks
      {
        id: 'readme',
        name: 'README',
        category: 'structural',
        status: hasReadme ? 'passed' : 'failed',
        passed: hasReadme,
        severity: 'high',
        failedDescription: hasReadme ? 'README exists' : 'No README found',
        whyItMatters:
          'A README is the first thing contributors read. Without one, people cannot understand your project purpose, how to set it up, or how to contribute.',
        recommendation:
          'Add a README.md with project description, installation steps, usage examples, and contribution guidelines.',
        estimatedEffort: '10-15 minutes',
        actionLabel: 'Generate README',
        actionType: 'generate-readme',
        scorePenalty: hasReadme ? 0 : 20,
        evidence: {
          readmeFound: hasReadme,
          pathsChecked: ['README.md', 'README.rst', 'README.txt'],
        },
      },
      {
        id: 'license',
        name: 'License',
        category: 'structural',
        status: hasLicense ? 'passed' : 'failed',
        passed: hasLicense,
        severity: 'medium',
        failedDescription: hasLicense ? 'License exists' : 'No LICENSE file found',
        whyItMatters:
          'Without a license, your code is not legally open source. Others have no permission to use, modify, or distribute your work.',
        recommendation:
          'Add a LICENSE file. MIT and Apache 2.0 are popular choices for open-source projects.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate LICENSE',
        actionType: 'generate-license',
        scorePenalty: hasLicense ? 0 : 10,
        evidence: {
          licenseFound: hasLicense,
          pathsChecked: ['LICENSE', 'LICENSE.md', 'LICENSE.txt'],
        },
      },
      {
        id: 'gitignore',
        name: 'Gitignore',
        category: 'structural',
        status: hasGitignore ? 'passed' : 'failed',
        passed: hasGitignore,
        severity: 'low',
        failedDescription: hasGitignore ? '.gitignore exists' : 'No .gitignore found',
        whyItMatters:
          'Without a .gitignore, build artifacts, dependencies, and secrets may be accidentally committed to version control.',
        recommendation:
          'Add a .gitignore to exclude node_modules, dist, .env, and other generated files.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate .gitignore',
        actionType: 'generate-gitignore',
        scorePenalty: hasGitignore ? 0 : 5,
        evidence: {
          gitignoreFound: hasGitignore,
          pathsChecked: ['.gitignore'],
        },
      },
      {
        id: 'package-config',
        name: 'Package Config',
        category: 'structural',
        status: hasPackageJson ? 'passed' : 'failed',
        passed: hasPackageJson,
        severity: 'medium',
        failedDescription: hasPackageJson ? 'package.json exists' : 'No package.json detected',
        whyItMatters:
          'A package.json defines dependencies, scripts, and project metadata. Without it, builds are not reproducible and onboarding is difficult.',
        recommendation:
          'Add a package.json with dependencies, scripts (build, test, lint), and project metadata.',
        estimatedEffort: '5-10 minutes',
        actionLabel: 'Generate package.json',
        actionType: 'generate-package-json',
        scorePenalty: hasPackageJson ? 0 : 10,
        evidence: {
          packageJsonFound: hasPackageJson,
          pathsChecked: ['package.json'],
        },
      },
      {
        id: 'docker',
        name: 'Docker',
        category: 'structural',
        status: 'not_applicable',
        passed: false,
        severity: 'low',
        failedDescription: hasDockerfile
          ? 'Docker configuration detected'
          : 'Docker is not required for this repository',
        whyItMatters:
          'Docker provides consistent development and deployment environments, but is not required for all projects.',
        recommendation:
          'Docker is optional. Consider adding a Dockerfile if containerization would benefit your project.',
        estimatedEffort: '10-15 minutes',
        actionLabel: 'Generate Dockerfile',
        actionType: 'generate-dockerfile',
        scorePenalty: 0,
        evidence: {
          dockerfileFound: hasDockerfile,
          pathsChecked: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
        },
      },
      {
        id: 'env-example',
        name: 'Env Example',
        category: 'structural',
        status: hasEnvExample ? 'passed' : 'failed',
        passed: hasEnvExample,
        severity: 'low',
        failedDescription: hasEnvExample ? '.env.example exists' : 'No .env.example found',
        whyItMatters:
          'New contributors have no way to know which environment variables are required. This leads to runtime errors and wasted setup time.',
        recommendation:
          'Add a .env.example listing all required environment variables with placeholder values.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate .env.example',
        actionType: 'generate-env-example',
        scorePenalty: hasEnvExample ? 0 : 5,
        evidence: {
          envExampleFound: hasEnvExample,
          pathsChecked: ['.env.example', '.env.sample', '.env.template'],
        },
      },
      // Quality checks
      {
        id: 'test-coverage',
        name: 'Test Coverage',
        category: 'quality',
        status: testCoverage.status,
        passed: testCoverage.status === 'passed',
        severity: testCoverage.status === 'not_measured' ? 'low' : 'high',
        failedDescription: testCoverage.description,
        whyItMatters:
          'Test coverage measures how much of your code is exercised by tests. Higher coverage reduces the risk of undetected regressions.',
        recommendation: testCoverage.recommendation,
        estimatedEffort: '1-2 hours',
        actionLabel: 'Improve Coverage',
        actionType: 'improve-coverage',
        scorePenalty: testCoverage.penalty,
        evidence: {
          testFileCount: testCoverage.testFileCount,
          coverageReportFound: testCoverage.coverage !== undefined,
          coverage: testCoverage.coverage,
        },
        quality: {
          coverage: testCoverage.coverage,
          testCount: testCoverage.testCount,
          testFileCount: testCoverage.testFileCount,
        },
      },
      {
        id: 'readme-quality',
        name: 'README Quality',
        category: 'quality',
        status: readmeQuality.status,
        passed: readmeQuality.status === 'passed',
        severity: 'high',
        failedDescription: readmeQuality.description,
        whyItMatters:
          'A comprehensive README helps users understand your project quickly and reduces support questions.',
        recommendation: readmeQuality.recommendation,
        estimatedEffort: '30-60 minutes',
        actionLabel: 'Improve README',
        actionType: 'improve-readme',
        scorePenalty: readmeQuality.penalty,
        evidence: {
          sectionsFound: readmeQuality.sectionsFound,
          sectionsMissing: readmeQuality.sectionsMissing,
          sectionScores: readmeQuality.sectionScores,
        },
        quality: {
          sectionsFound: readmeQuality.sectionsFound,
          sectionsMissing: readmeQuality.sectionsMissing,
          sectionScores: readmeQuality.sectionScores,
        },
      },
      {
        id: 'ci-cd',
        name: 'CI/CD Pipeline',
        category: 'quality',
        status: cicdQuality.status,
        passed: cicdQuality.status === 'passed',
        severity: 'high',
        failedDescription: cicdQuality.description,
        whyItMatters:
          'A complete CI/CD pipeline ensures code quality, security, and deployment consistency.',
        recommendation: cicdQuality.recommendation,
        estimatedEffort: '1-2 hours',
        actionLabel: 'Add CI Pipeline',
        actionType: 'add-ci-pipeline',
        scorePenalty: cicdQuality.penalty,
        evidence: {
          workflowCount: cicdQuality.workflowCount,
          workflowPaths,
          workflowTypes: cicdQuality.workflowTypes,
        },
        quality: {
          workflowCount: cicdQuality.workflowCount,
          passingWorkflows: cicdQuality.passingWorkflows,
          failingWorkflows: cicdQuality.failingWorkflows,
        },
      },
      {
        id: 'security',
        name: 'Security',
        category: 'quality',
        status: securityQuality.status,
        passed: securityQuality.status === 'passed',
        severity:
          securityQuality.status === 'failed' && securityQuality.vulnerabilityCount > 0
            ? 'critical'
            : securityQuality.status === 'not_measured'
              ? 'low'
              : 'high',
        failedDescription: securityQuality.description,
        whyItMatters:
          'Security vulnerabilities can expose sensitive data and compromise your application.',
        recommendation: securityQuality.recommendation,
        estimatedEffort: '1-4 hours',
        actionLabel: 'Fix Vulnerabilities',
        actionType: 'fix-vulnerabilities',
        scorePenalty: securityQuality.penalty,
        evidence: {
          hasSecurityPolicy: securityQuality.hasSecurityPolicy,
          hasDependabot: securityQuality.hasDependabot,
          hasCodeql: securityQuality.hasCodeql,
          hasAuditConfig: securityQuality.hasAuditConfig,
          vulnerabilityCount: securityQuality.vulnerabilityCount,
          dependabotAccessible: securityQuality.dependabotAccessible,
        },
        quality: {
          vulnerabilityCount: securityQuality.vulnerabilityCount,
          criticalVulnerabilities: securityQuality.criticalVulnerabilities,
          highVulnerabilities: securityQuality.highVulnerabilities,
          vulnerabilities: securityQuality.vulnerabilities.map((v) => ({
            ...v,
            severity: v.severity as 'critical' | 'high' | 'medium' | 'low',
          })),
        },
      },
      {
        id: 'dependencies',
        name: 'Dependencies',
        category: 'quality',
        status: dependencyQuality.status,
        passed: dependencyQuality.status === 'passed',
        severity: 'medium',
        failedDescription: dependencyQuality.description,
        whyItMatters:
          'Outdated dependencies may have security vulnerabilities and miss important features.',
        recommendation: dependencyQuality.recommendation,
        estimatedEffort: '30-60 minutes',
        actionLabel: 'Update Dependencies',
        actionType: 'update-dependencies',
        scorePenalty: dependencyQuality.penalty,
        evidence: {
          totalDependencies: dependencyQuality.totalDependencies,
          outdatedDependencies: dependencyQuality.outdatedDependencies,
          outdatedPercentage: dependencyQuality.outdatedPercentage,
          hasLockfile: dependencyQuality.hasLockfile,
          lockfilePaths,
          outdatedPackages: dependencyQuality.outdatedPackages,
        },
        quality: {
          totalDependencies: dependencyQuality.totalDependencies,
          outdatedDependencies: dependencyQuality.outdatedDependencies,
          outdatedPercentage: dependencyQuality.outdatedPercentage,
        },
      },
      {
        id: 'documentation',
        name: 'Documentation',
        category: 'quality',
        status: hasDocumentation ? 'passed' : 'warning',
        passed: hasDocumentation,
        severity: 'medium',
        failedDescription: hasDocumentation
          ? 'Additional documentation exists'
          : 'No additional documentation found',
        whyItMatters:
          'A README alone is often not enough. Without a docs/ folder, CONTRIBUTING.md, or CHANGELOG, contributors lack context on conventions and project history.',
        recommendation:
          'Add a docs/ directory, CONTRIBUTING.md, or CHANGELOG.md to supplement the README.',
        estimatedEffort: '15-30 minutes',
        actionLabel: 'Generate Docs',
        actionType: 'generate-docs',
        scorePenalty: hasDocumentation ? 0 : 10,
        evidence: {
          docsFound: hasDocumentation,
          pathsChecked: ['docs/', 'CONTRIBUTING.md', 'CHANGELOG.md'],
        },
      },
      // Complexity check
      {
        id: 'complexity',
        name: 'Code Complexity',
        category: 'quality',
        status:
          complexityResult.complexityScore >= 70
            ? 'passed'
            : complexityResult.complexityScore >= 40
              ? 'warning'
              : 'failed',
        passed: complexityResult.complexityScore >= 70,
        severity: complexityResult.complexityScore < 40 ? 'high' : 'medium',
        failedDescription:
          complexityResult.largeFiles.length > 0
            ? `${complexityResult.largeFiles.length} large files detected (${complexityResult.complexityScore}/100 score)`
            : `Code complexity score: ${complexityResult.complexityScore}/100`,
        whyItMatters:
          'Large files are harder to maintain, test, and review. They increase cognitive load and the risk of bugs.',
        recommendation:
          'Consider breaking large files into smaller, focused modules. Files over 500 lines should be reviewed for splitting.',
        estimatedEffort: '2-4 hours',
        actionLabel: 'Review Complexity',
        actionType: 'none',
        scorePenalty:
          complexityResult.complexityScore >= 70
            ? 0
            : Math.round((100 - complexityResult.complexityScore) / 5),
        evidence: {
          sourceFilesAnalyzed: complexityResult.sourceFilesAnalyzed,
          largeFileThreshold: 500,
          veryLargeFileThreshold: 1000,
          largeFiles: complexityResult.largeFiles.map((f) => ({ path: f.path, lines: f.lines })),
        },
        quality: {
          complexityScore: complexityResult.complexityScore,
          largeFiles: complexityResult.largeFiles,
        },
      },
      // Technical debt check
      {
        id: 'debt',
        name: 'Technical Debt',
        category: 'quality',
        status:
          debtResult.debtScore >= 70 ? 'passed' : debtResult.debtScore >= 40 ? 'warning' : 'failed',
        passed: debtResult.debtScore >= 70,
        severity: debtResult.debtScore < 40 ? 'high' : 'medium',
        failedDescription:
          debtResult.debtItems.length > 0
            ? `${debtResult.debtItems.reduce((sum, d) => sum + d.count, 0)} debt indicators found across ${debtResult.debtItems.length} patterns (score: ${debtResult.debtScore}/100)`
            : `Technical debt score: ${debtResult.debtScore}/100`,
        whyItMatters:
          'Technical debt accumulates over time, slowing development and increasing the risk of regressions.',
        recommendation:
          'Address high-severity debt items first (HACKs, critical TODOs). Establish a pattern of fixing debt alongside feature work.',
        estimatedEffort: '1-4 hours',
        actionLabel: 'Review Debt',
        actionType: 'none',
        scorePenalty: debtResult.debtScore >= 70 ? 0 : Math.round((100 - debtResult.debtScore) / 5),
        evidence: {
          patternsScanned: debtResult.patternsScanned,
          totalIndicators: debtResult.debtItems.reduce((sum, d) => sum + d.count, 0),
          debtItems: debtResult.debtItems.map((d) => ({
            pattern: d.pattern,
            count: d.count,
            severity: d.severity,
            sampleFiles: d.files.slice(0, 3),
          })),
        },
        quality: {
          debtItems: debtResult.debtItems,
          debtScore: debtResult.debtScore,
        },
      },
      // Hotspot check
      {
        id: 'hotspots',
        name: 'Code Hotspots',
        category: 'quality',
        status:
          hotspotResult.hotspotCount <= 3
            ? 'passed'
            : hotspotResult.hotspotCount <= 7
              ? 'warning'
              : 'failed',
        passed: hotspotResult.hotspotCount <= 3,
        severity: hotspotResult.hotspotCount > 7 ? 'high' : 'medium',
        failedDescription:
          hotspotResult.hotspotCount > 0
            ? `${hotspotResult.hotspotCount} hotspot files with high churn detected`
            : 'No significant hotspots detected',
        whyItMatters:
          'Files that change frequently are often architectural hotspots. High churn combined with large size increases defect risk.',
        recommendation:
          'Consider extracting stable abstractions from high-churn files. Review these files for architecture improvements.',
        estimatedEffort: '2-4 hours',
        actionLabel: 'Review Hotspots',
        actionType: 'none',
        scorePenalty:
          hotspotResult.hotspotCount <= 3 ? 0 : Math.min(15, (hotspotResult.hotspotCount - 3) * 3),
        evidence: {
          hotspotCount: hotspotResult.hotspotCount,
          threshold: 3,
          method: 'Commit activity frequency combined with file size',
          hotspots: hotspotResult.hotspots.map((h) => ({
            path: h.path,
            changeFrequency: h.changeFrequency,
            sizeBytes: h.sizeBytes,
            churnScore: h.churnScore,
          })),
        },
        quality: {
          hotspots: hotspotResult.hotspots,
        },
      },
    ];

    // Calculate weighted scores
    const structuralChecks = details.filter((d) => d.category === 'structural');
    const qualityChecks = details.filter((d) => d.category === 'quality');

    const structuralWeight = 40;
    const qualityWeight = 60;

    const structuralPenalty = structuralChecks.reduce((sum, d) => sum + d.scorePenalty, 0);
    const qualityPenalty = qualityChecks.reduce((sum, d) => sum + d.scorePenalty, 0);

    // Max penalties — must match the sum of all possible penalties per category.
    // Structural: README(20) + License(10) + Gitignore(5) + PackageConfig(10) + Docker(0=N/A) + EnvExample(5) = 50
    // Quality: TestCoverage(30) + ReadmeQuality(25) + CI/CD(30) + Security(20) + Dependencies(15) + Documentation(10) + Complexity(20) + Debt(20) + Hotspots(15) = 185
    const maxStructuralPenalty = 50;
    const maxQualityPenalty = 185;

    // Per-check-type max penalties for sub-category scores
    const maxSecurityPenalty = 20;
    const maxDependencyPenalty = 15;
    const maxHotspotPenalty = 15;
    const maxCicdPenalty = 30;
    const maxReadmeQualityPenalty = 25;

    const structuralScore = Math.max(0, 100 - (structuralPenalty / maxStructuralPenalty) * 100);
    const qualityScore = Math.max(0, 100 - (qualityPenalty / maxQualityPenalty) * 100);

    const score = Math.round(
      (structuralScore * structuralWeight) / 100 + (qualityScore * qualityWeight) / 100,
    );

    // Sub-category scores — all use the same penalty/maxPenalty formula
    const securityScore = Math.max(0, 100 - (securityQuality.penalty / maxSecurityPenalty) * 100);
    const dependencyScore = Math.max(
      0,
      100 - (dependencyQuality.penalty / maxDependencyPenalty) * 100,
    );
    // Maintainability = average of complexity, debt, and hotspot scores
    const hotspotCheck = details.find((d) => d.id === 'hotspots');
    const hotspotScore = hotspotCheck
      ? Math.max(0, 100 - (hotspotCheck.scorePenalty / maxHotspotPenalty) * 100)
      : 100;
    const maintainabilityScore = Math.round(
      (complexityResult.complexityScore + debtResult.debtScore + hotspotScore) / 3,
    );
    const cicdScore = Math.max(0, 100 - (cicdQuality.penalty / maxCicdPenalty) * 100);
    const documentationScore = Math.max(
      0,
      100 - (readmeQuality.penalty / maxReadmeQualityPenalty) * 100,
    );

    const passedCount = details.filter((d) => d.passed).length;
    const failedCount = details.filter(
      (d) => !d.passed && d.status !== 'not_measured' && d.status !== 'not_applicable',
    ).length;
    const warningCount = details.filter((d) => d.status === 'warning').length;
    const notMeasuredCount = details.filter(
      (d) => d.status === 'not_measured' || d.status === 'not_applicable',
    ).length;
    const criticalCount = details.filter(
      (d) =>
        !d.passed &&
        d.status !== 'not_measured' &&
        d.status !== 'not_applicable' &&
        d.severity === 'critical',
    ).length;

    const scoreBreakdown: ScoreBreakdownItem[] = details
      .filter((d) => d.scorePenalty > 0)
      .map((d) => ({ name: d.name, penalty: d.scorePenalty, category: d.category }));

    const health: RepositoryHealth = {
      score,
      passedCount,
      failedCount,
      warningCount,
      notMeasuredCount,
      criticalCount,
      details,
      scoreBreakdown,
      summary: {
        structuralScore: Math.round(structuralScore),
        qualityScore: Math.round(qualityScore),
        structuralWeight,
        qualityWeight,
        testCoverage: testCoverage.coverage,
        documentationScore: Math.round(documentationScore),
        cicdScore: Math.round(cicdScore),
        securityScore: Math.round(securityScore),
        dependencyScore: Math.round(dependencyScore),
        complexityScore: complexityResult.complexityScore,
        debtScore: debtResult.debtScore,
        hotspotCount: hotspotResult.hotspotCount,
        maintainabilityScore: Math.round(maintainabilityScore),
      },
    };

    this.set(key, health);

    // Persist health snapshot (best-effort, non-blocking)
    this.saveHealthSnapshot(userId, owner, repo, health).catch(() => {
      // Silently ignore snapshot persistence failures
    });

    return health;
  }

  private async saveHealthSnapshot(
    userId: string,
    owner: string,
    repo: string,
    health: RepositoryHealth,
  ): Promise<void> {
    try {
      await db.repoHealthSnapshot.create({
        data: {
          userId,
          owner,
          repo,
          score: health.score,
          passedCount: health.passedCount,
          failedCount: health.failedCount,
          criticalCount: health.criticalCount,
          structuralScore: health.summary.structuralScore,
          qualityScore: health.summary.qualityScore,
          details: JSON.parse(JSON.stringify(health.details)),
          scoreBreakdown: JSON.parse(JSON.stringify(health.scoreBreakdown)),
          summary: JSON.parse(JSON.stringify(health.summary)),
        },
      });
    } catch {
      // Best-effort persistence — don't fail the health check if snapshot save fails
    }
  }

  // ─── Health Check Quality Analysis Helpers ──────────────────────────────────

  private analyzeTestCoverage(
    coverageContent: string | undefined,
    filePaths: string[],
  ): {
    status: 'passed' | 'failed' | 'warning' | 'partial' | 'not_measured';
    description: string;
    recommendation: string;
    penalty: number;
    coverage?: number;
    testCount?: number;
    testFileCount?: number;
  } {
    const testFiles = filePaths.filter(
      (p) =>
        p.includes('.test.') ||
        p.includes('.spec.') ||
        p.includes('__tests__') ||
        (p.includes('test/') && p.endsWith('.ts')) ||
        (p.includes('test/') && p.endsWith('.tsx')) ||
        (p.includes('test/') && p.endsWith('.js')),
    );
    const testFileCount = testFiles.length;

    if (testFileCount === 0) {
      return {
        status: 'failed',
        description: 'No test files detected',
        recommendation:
          'Add unit tests for critical business logic. Start with core functions and components.',
        penalty: 30,
        testFileCount: 0,
      };
    }

    let coverage: number | undefined;

    if (coverageContent) {
      try {
        const coverageData = JSON.parse(coverageContent);
        if (coverageData.total?.statements?.pct !== undefined) {
          coverage = coverageData.total.statements.pct;
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (coverage !== undefined) {
      if (coverage >= 80) {
        return {
          status: 'passed',
          description: `Excellent test coverage: ${coverage}%`,
          recommendation: 'Maintain current coverage levels.',
          penalty: 0,
          coverage,
          testCount: testFileCount,
          testFileCount,
        };
      }
      if (coverage >= 60) {
        return {
          status: 'warning',
          description: `Moderate test coverage: ${coverage}%`,
          recommendation: 'Increase coverage to 80% for better regression detection.',
          penalty: 10,
          coverage,
          testCount: testFileCount,
          testFileCount,
        };
      }
      return {
        status: 'failed',
        description: `Low test coverage: ${coverage}%`,
        recommendation: 'Increase coverage to at least 60% to catch critical regressions.',
        penalty: 20,
        coverage,
        testCount: testFileCount,
        testFileCount,
      };
    }

    // No coverage report found - report as NOT_MEASURED, not as a failure
    return {
      status: 'not_measured',
      description: `${testFileCount} test file(s) found but no coverage report available`,
      recommendation:
        'Set up coverage reporting (e.g., vitest --coverage, jest --coverage) to measure test effectiveness.',
      penalty: 0,
      testCount: testFileCount,
      testFileCount,
    };
  }

  private analyzeReadmeQuality(readmeContent: string | undefined): {
    status: 'passed' | 'failed' | 'warning' | 'partial';
    description: string;
    recommendation: string;
    penalty: number;
    sectionsFound: string[];
    sectionsMissing: string[];
    sectionScores: Record<string, number>;
  } {
    if (!readmeContent) {
      return {
        status: 'failed',
        description: 'No README content to analyze',
        recommendation: 'Add a comprehensive README.md file.',
        penalty: 25,
        sectionsFound: [],
        sectionsMissing: ['description', 'installation', 'usage', 'api', 'contributing'],
        sectionScores: {},
      };
    }

    const sections = {
      description: {
        patterns: [/# .*description/i, /# .*about/i, /# .*overview/i, /# .*introduction/i],
        weight: 25,
      },
      installation: { patterns: [/## .*install/i, /### .*install/i, /# .*install/i], weight: 25 },
      usage: {
        patterns: [/## .*usage/i, /### .*usage/i, /## .*example/i, /### .*example/i, /# .*usage/i],
        weight: 25,
      },
      api: {
        patterns: [/## .*api/i, /### .*api/i, /## .*endpoint/i, /### .*endpoint/i, /# .*api/i],
        weight: 15,
      },
      contributing: {
        patterns: [/## .*contribut/i, /### .*contribut/i, /# .*contribut/i],
        weight: 10,
      },
    };

    const sectionsFound: string[] = [];
    const sectionsMissing: string[] = [];
    const sectionScores: Record<string, number> = {};
    let totalScore = 0;

    for (const [name, config] of Object.entries(sections)) {
      const found = config.patterns.some((p) => p.test(readmeContent));
      if (found) {
        sectionsFound.push(name);
        sectionScores[name] = config.weight;
        totalScore += config.weight;
      } else {
        sectionsMissing.push(name);
        sectionScores[name] = 0;
      }
    }

    const coveragePercent = Math.round((totalScore / 100) * 100);

    if (coveragePercent >= 80) {
      return {
        status: 'passed',
        description: `Comprehensive README (${coveragePercent}% section coverage)`,
        recommendation: 'README looks good. Consider adding more examples if needed.',
        penalty: 0,
        sectionsFound,
        sectionsMissing,
        sectionScores,
      };
    }

    if (coveragePercent >= 50) {
      return {
        status: 'warning',
        description: `README needs improvement (${coveragePercent}% section coverage)`,
        recommendation: `Add missing sections: ${sectionsMissing.join(', ')}`,
        penalty: Math.round((100 - coveragePercent) / 10),
        sectionsFound,
        sectionsMissing,
        sectionScores,
      };
    }

    return {
      status: 'failed',
      description: `Incomplete README (${coveragePercent}% section coverage)`,
      recommendation: `Add these sections: ${sectionsMissing.join(', ')}`,
      penalty: Math.round((100 - coveragePercent) / 5),
      sectionsFound,
      sectionsMissing,
      sectionScores,
    };
  }

  private analyzeCicdWorkflows(
    workflowContents: string[],
    workflowPaths: string[],
  ): {
    status: 'passed' | 'failed' | 'warning' | 'partial';
    description: string;
    recommendation: string;
    penalty: number;
    workflowCount: number;
    passingWorkflows: number;
    failingWorkflows: number;
    workflowTypes: string[];
  } {
    const workflowCount = workflowPaths.length;

    if (workflowCount === 0) {
      return {
        status: 'failed',
        description: 'No CI/CD workflows detected',
        recommendation: 'Add GitHub Actions workflows for testing, linting, and deployment.',
        penalty: 30,
        workflowCount: 0,
        passingWorkflows: 0,
        failingWorkflows: 0,
        workflowTypes: [],
      };
    }

    let hasTestWorkflow = false;
    let hasLintWorkflow = false;
    let hasDeployWorkflow = false;
    let hasSecurityWorkflow = false;

    for (const content of workflowContents) {
      if (!content) continue;
      const lower = content.toLowerCase();
      if (lower.includes('test') || lower.includes('vitest') || lower.includes('jest')) {
        hasTestWorkflow = true;
      }
      if (lower.includes('lint') || lower.includes('eslint') || lower.includes('prettier')) {
        hasLintWorkflow = true;
      }
      if (lower.includes('deploy') || lower.includes('release') || lower.includes('publish')) {
        hasDeployWorkflow = true;
      }
      if (lower.includes('security') || lower.includes('codeql') || lower.includes('snyk')) {
        hasSecurityWorkflow = true;
      }
    }

    const workflowTypes = [
      hasTestWorkflow,
      hasLintWorkflow,
      hasDeployWorkflow,
      hasSecurityWorkflow,
    ];
    const workflowScore = workflowTypes.filter(Boolean).length;
    const totalPossible = 4;

    const detectedTypes: string[] = [];
    if (hasTestWorkflow) detectedTypes.push('testing');
    if (hasLintWorkflow) detectedTypes.push('linting');
    if (hasDeployWorkflow) detectedTypes.push('deployment');
    if (hasSecurityWorkflow) detectedTypes.push('security');

    if (workflowScore >= 3) {
      return {
        status: 'passed',
        description: `Comprehensive CI/CD (${workflowScore}/${totalPossible} workflow types)`,
        recommendation: 'CI/CD setup looks good.',
        penalty: 0,
        workflowCount,
        passingWorkflows: workflowCount,
        failingWorkflows: 0,
        workflowTypes: detectedTypes,
      };
    }

    if (workflowScore >= 2) {
      return {
        status: 'warning',
        description: `Partial CI/CD coverage (${workflowScore}/${totalPossible} workflow types)`,
        recommendation: `Add missing workflows: ${[
          !hasTestWorkflow && 'testing',
          !hasLintWorkflow && 'linting',
          !hasDeployWorkflow && 'deployment',
          !hasSecurityWorkflow && 'security scanning',
        ]
          .filter(Boolean)
          .join(', ')}`,
        penalty: (totalPossible - workflowScore) * 5,
        workflowCount,
        passingWorkflows: workflowCount,
        failingWorkflows: 0,
        workflowTypes: detectedTypes,
      };
    }

    return {
      status: 'partial',
      description: `Basic CI/CD (${workflowScore}/${totalPossible} workflow types)`,
      recommendation: 'Add more workflow types for comprehensive automation.',
      penalty: (totalPossible - workflowScore) * 5,
      workflowCount,
      passingWorkflows: workflowCount,
      failingWorkflows: 0,
      workflowTypes: detectedTypes,
    };
  }

  private async analyzeSecurity(
    userId: string,
    owner: string,
    repo: string,
    filePaths: string[],
  ): Promise<{
    status: 'passed' | 'failed' | 'warning' | 'partial' | 'not_measured';
    description: string;
    recommendation: string;
    penalty: number;
    vulnerabilityCount: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    vulnerabilities: Array<{
      severity: string;
      package: string;
      description: string;
      withdrawn: boolean;
    }>;
    hasSecurityPolicy: boolean;
    hasDependabot: boolean;
    hasCodeql: boolean;
    hasAuditConfig: boolean;
    dependabotAccessible: boolean;
  }> {
    // Check for security-related files
    const hasSecurityPolicy = filePaths.some(
      (p) => p === 'SECURITY.md' || p === '.github/SECURITY.md',
    );
    const hasDependabot = filePaths.some(
      (p) => p === '.github/dependabot.yml' || p === '.github/dependabot.yaml',
    );
    const hasCodeql = filePaths.some(
      (p) => p.includes('.github/workflows/') && p.toLowerCase().includes('codeql'),
    );

    // Check for npm audit or similar
    const hasAuditConfig = filePaths.some(
      (p) => p === '.snyk' || p === '.npmrc' || p === 'audit-ci.json',
    );

    // Fetch actual Dependabot alerts from GitHub API
    let vulnerabilityCount = 0;
    let criticalVulnerabilities = 0;
    let highVulnerabilities = 0;
    let dependabotAccessible = false;
    const vulnerabilities: Array<{
      severity: string;
      package: string;
      description: string;
      withdrawn: boolean;
    }> = [];

    try {
      const octokit = await getOctokit(userId);
      const alerts = await octokit.paginate(octokit.rest.dependabot.listAlertsForRepo, {
        owner,
        repo,
        state: 'open',
        per_page: 100,
      });
      dependabotAccessible = true;

      for (const alert of alerts) {
        if (alert.dismissed_at) continue;

        const severity = alert.security_advisory?.severity || 'low';
        const packageName = alert.dependency?.package?.name || 'unknown';
        const description =
          alert.security_advisory?.summary || alert.security_advisory?.description || '';
        const withdrawn = !!(alert as Record<string, unknown>).withdrawn_at;

        vulnerabilityCount++;

        if (severity === 'critical') criticalVulnerabilities++;
        else if (severity === 'high') highVulnerabilities++;

        vulnerabilities.push({
          severity,
          package: packageName,
          description: description.slice(0, 200),
          withdrawn,
        });
      }
    } catch {
      // Dependabot API may not be accessible (e.g., public repos without token permissions)
      // Report this limitation rather than silently returning 0
    }

    const securityFiles = [hasSecurityPolicy, hasDependabot, hasCodeql, hasAuditConfig];
    const securityConfigScore = securityFiles.filter(Boolean).length;

    // Combine file-based scoring with actual vulnerability data
    const hasVulnerabilities = vulnerabilityCount > 0;

    // If Dependabot was accessible, we have reliable vulnerability data
    if (dependabotAccessible) {
      if (hasVulnerabilities) {
        // Vulnerabilities found → FAILED
        const penalty = Math.min(20, 10 + criticalVulnerabilities * 5 + highVulnerabilities * 2);
        const missingFiles = [
          !hasSecurityPolicy && 'SECURITY.md',
          !hasDependabot && 'Dependabot config',
          !hasCodeql && 'CodeQL workflow',
          !hasAuditConfig && 'Audit configuration',
        ].filter(Boolean);

        return {
          status: 'failed',
          description: `${vulnerabilityCount} open vulnerabilities detected`,
          recommendation: `Address ${criticalVulnerabilities} critical and ${highVulnerabilities} high severity vulnerabilities. ${missingFiles.length > 0 ? `Also add: ${missingFiles.join(', ')}` : ''}`,
          penalty,
          vulnerabilityCount,
          criticalVulnerabilities,
          highVulnerabilities,
          vulnerabilities,
          hasSecurityPolicy,
          hasDependabot,
          hasCodeql,
          hasAuditConfig,
          dependabotAccessible,
        };
      }

      // Dependabot accessible, 0 vulnerabilities → PASSED (regardless of config files)
      return {
        status: 'passed',
        description: 'No known vulnerabilities detected',
        recommendation:
          securityConfigScore >= 3
            ? 'Security setup looks comprehensive.'
            : 'Consider adding SECURITY.md, Dependabot config, and CodeQL workflow for defense in depth.',
        penalty: 0,
        vulnerabilityCount,
        criticalVulnerabilities,
        highVulnerabilities,
        vulnerabilities,
        hasSecurityPolicy,
        hasDependabot,
        hasCodeql,
        hasAuditConfig,
        dependabotAccessible,
      };
    }

    // Dependabot NOT accessible → can't confirm security status
    if (securityConfigScore >= 3) {
      // Has security config but can't verify vulnerabilities → WARNING (not failed)
      return {
        status: 'warning',
        description: 'Security configuration present but vulnerability scan could not be verified',
        recommendation:
          'Dependabot API was not accessible. Verify vulnerability scanning is working.',
        penalty: 5,
        vulnerabilityCount,
        criticalVulnerabilities,
        highVulnerabilities,
        vulnerabilities,
        hasSecurityPolicy,
        hasDependabot,
        hasCodeql,
        hasAuditConfig,
        dependabotAccessible,
      };
    }

    // No config, no access → NOT_MEASURED (can't determine security status)
    return {
      status: 'not_measured',
      description:
        'Unable to verify security status - no security configuration and Dependabot not accessible',
      recommendation:
        'Add SECURITY.md, Dependabot config, and CodeQL workflow for security scanning.',
      penalty: 0,
      vulnerabilityCount,
      criticalVulnerabilities,
      highVulnerabilities,
      vulnerabilities,
      hasSecurityPolicy,
      hasDependabot,
      hasCodeql,
      hasAuditConfig,
      dependabotAccessible,
    };
  }

  private async analyzeDependencies(
    userId: string,
    owner: string,
    repo: string,
    packageJsonPath: string | undefined,
    lockfilePaths: string[],
  ): Promise<{
    status: 'passed' | 'failed' | 'warning' | 'partial';
    description: string;
    recommendation: string;
    penalty: number;
    totalDependencies: number;
    outdatedDependencies: number;
    outdatedPercentage: number;
    hasLockfile: boolean;
    outdatedPackages: Array<{ name: string; current: string; latest: string }>;
  }> {
    if (!packageJsonPath) {
      return {
        status: 'failed',
        description: 'No package.json found',
        recommendation: 'Add a package.json to manage dependencies.',
        penalty: 15,
        totalDependencies: 0,
        outdatedDependencies: 0,
        outdatedPercentage: 0,
        hasLockfile: false,
        outdatedPackages: [],
      };
    }

    const hasLockfile = lockfilePaths.length > 0;
    const packageJson = await this.getFileContent(userId, owner, repo, packageJsonPath);

    if (!packageJson) {
      return {
        status: 'warning',
        description: 'Could not read package.json',
        recommendation: 'Ensure package.json is accessible.',
        penalty: 5,
        totalDependencies: 0,
        outdatedDependencies: 0,
        outdatedPercentage: 0,
        hasLockfile,
        outdatedPackages: [],
      };
    }

    let totalDeps = 0;
    let allDeps: Record<string, string> = {};
    try {
      const pkg = JSON.parse(packageJson.content);
      allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      totalDeps = Object.keys(allDeps).length;
    } catch {
      // Ignore parse errors
    }

    // Check for outdated dependencies by querying npm registry
    let outdatedCount = 0;
    const outdatedPackages: Array<{ name: string; current: string; latest: string }> = [];
    const depsToCheck = Object.entries(allDeps).slice(0, 30); // Limit to avoid rate limiting

    const results = await Promise.allSettled(
      depsToCheck.map(async ([name, currentVersion]) => {
        try {
          const cleanVersion = currentVersion.replace(/^[\^~>=<]*/, '');
          const response = await fetch(
            `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
            {
              signal: AbortSignal.timeout(3000),
            },
          );
          if (!response.ok) return null;
          const data = (await response.json()) as { version?: string };
          if (!data.version) return null;
          if (data.version !== cleanVersion) {
            return { name, current: cleanVersion, latest: data.version };
          }
          return null;
        } catch {
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        outdatedCount++;
        outdatedPackages.push(result.value);
      }
    }

    const outdatedPercentage =
      depsToCheck.length > 0 ? Math.round((outdatedCount / depsToCheck.length) * 100) : 0;

    if (!hasLockfile) {
      return {
        status: 'warning',
        description: 'No lockfile found',
        recommendation:
          'Add a lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml) for reproducible builds.',
        penalty: 10,
        totalDependencies: totalDeps,
        outdatedDependencies: outdatedCount,
        outdatedPercentage,
        hasLockfile: false,
        outdatedPackages,
      };
    }

    if (outdatedCount > 0) {
      return {
        status: outdatedPercentage > 50 ? 'failed' : 'warning',
        description: `${outdatedCount} of ${depsToCheck.length} checked dependencies are outdated (${outdatedPercentage}%)${totalDeps > depsToCheck.length ? ` (${totalDeps} total)` : ''}`,
        recommendation: `Update ${outdatedCount} outdated dependencies. Run "npm outdated" to see details.`,
        penalty: Math.min(15, Math.round(outdatedPercentage / 5)),
        totalDependencies: totalDeps,
        outdatedDependencies: outdatedCount,
        outdatedPercentage,
        hasLockfile: true,
        outdatedPackages,
      };
    }

    return {
      status: 'passed',
      description: `Dependencies managed with lockfile (${totalDeps} packages, all up to date)`,
      recommendation: 'Dependencies look good.',
      penalty: 0,
      totalDependencies: totalDeps,
      outdatedDependencies: 0,
      outdatedPercentage: 0,
      hasLockfile: true,
      outdatedPackages: [],
    };
  }

  // ─── Repository Statistics ───────────────────────────────────────────────

  async getStatistics(userId: string, owner: string, repo: string): Promise<RepositoryStatistics> {
    const key = cacheKey([owner, repo, 'statistics']);
    const cached = this.get<RepositoryStatistics>(key, STATS_CACHE_TTL);
    if (cached) return cached;

    const [languages, contributors, branches, pulls, issues, releases] = await Promise.all([
      this.getLanguages(userId, owner, repo),
      this.getContributors(userId, owner, repo, 100),
      this.getBranches(userId, owner, repo),
      this.getPullRequests(userId, owner, repo, 'all', 1),
      this.getIssues(userId, owner, repo, 'all', 1),
      this.getReleases(userId, owner, repo, 1),
    ]);

    const tree = await this.getFileTree(userId, owner, repo);
    const countResult = this.countNodes(tree);

    const statistics: RepositoryStatistics = {
      totalFiles: countResult.files,
      totalDirectories: countResult.directories,
      totalBranches: branches.length,
      totalCommits: 0, // Requires separate API call, set to 0 for stats overview
      totalPullRequests: pulls.length,
      totalIssues: issues.length,
      totalReleases: releases.length,
      totalContributors: contributors.length,
      languageBreakdown: languages,
    };

    this.set(key, statistics);
    return statistics;
  }

  // ─── Technology Analysis ─────────────────────────────────────────────────

  async getTechnologyAnalysis(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<RepositoryIntelligence> {
    const resolvedBranch = branch || (await this.getDefaultBranch(userId, owner, repo));
    const key = cacheKey([owner, repo, 'intelligence', resolvedBranch]);
    const cached = this.get<RepositoryIntelligence>(key);
    if (cached) return cached;

    const octokit = await getOctokit(userId);

    // Fetch file tree
    let tree: { path: string; type: string }[] = [];
    try {
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: resolvedBranch,
        recursive: 'true',
      });
      tree = treeData.tree
        .filter((e) => e.type === 'blob')
        .map((e) => ({ path: e.path, type: e.type }));
    } catch {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: repoData.default_branch,
        recursive: 'true',
      });
      tree = treeData.tree
        .filter((e) => e.type === 'blob')
        .map((e) => ({ path: e.path, type: e.type }));
      resolvedBranch;
    }

    const filePaths = tree.map((e) => e.path);

    // Fetch key files
    const filesToFetch = ['package.json', 'tsconfig.json', 'README.md', 'pnpm-workspace.yaml'];
    const fileContents = new Map<string, string>();
    const packageJsons = new Map<string, Record<string, unknown>>();

    await Promise.all(
      filesToFetch.map(async (path) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: resolvedBranch,
          });
          if ('content' in data && typeof data.content === 'string') {
            const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
            fileContents.set(path, decoded);
            if (path === 'package.json') {
              try {
                packageJsons.set('root', JSON.parse(decoded));
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* file doesn't exist */
        }
      }),
    );

    // Fetch nested package.json files (monorepo)
    const pkgPaths = filePaths
      .filter((p) => p.endsWith('/package.json') && !p.includes('node_modules'))
      .sort((a, b) => {
        const aIsApp = a.startsWith('apps/') ? 0 : 1;
        const bIsApp = b.startsWith('apps/') ? 0 : 1;
        return aIsApp - bIsApp;
      });

    await Promise.all(
      pkgPaths.slice(0, 20).map(async (path) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: resolvedBranch,
          });
          if ('content' in data && typeof data.content === 'string') {
            const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
            fileContents.set(path, decoded);
            try {
              packageJsons.set(path, JSON.parse(decoded));
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      }),
    );

    // Merge dependencies
    const mergedDeps: Record<string, string> = {};
    const mergedDevDeps: Record<string, string> = {};
    for (const pkg of packageJsons.values()) {
      const deps = (pkg.dependencies as Record<string, string>) || {};
      const devDeps = (pkg.devDependencies as Record<string, string>) || {};
      Object.assign(mergedDeps, deps);
      Object.assign(mergedDevDeps, devDeps);
    }
    const rootPkg = (packageJsons.get('root') || {}) as Record<string, unknown>;
    const { dependencies: _rootDeps, devDependencies: _rootDevDeps, ...rootMeta } = rootPkg;
    const mergedPkg: Record<string, unknown> | null =
      packageJsons.size > 0
        ? { ...rootMeta, dependencies: mergedDeps, devDependencies: mergedDevDeps }
        : null;

    // Run detections
    const projectType = mergedPkg ? detectPackageJsonType(mergedPkg) : 'unknown';
    const packageManager = detectPackageManager(filePaths);
    const languages = detectLanguages(filePaths, null);
    const frameworks = detectFrameworks(filePaths, mergedPkg);
    const databases = detectDatabases(filePaths, mergedPkg);
    const orms = detectORMs(filePaths, mergedPkg);
    const testing = detectTestingFrameworks(filePaths, mergedPkg);
    const styling = detectStyling(filePaths, mergedPkg);
    const stateManagement = detectStateManagement(filePaths, mergedPkg);
    const buildTools = detectBuildTools(filePaths, mergedPkg);
    const lintingTools = detectLintingTools(filePaths, mergedPkg);
    const formattingTools = detectFormattingTools(filePaths, mergedPkg);
    const importantFiles = detectImportantFiles(filePaths);
    const folderTreeSummary = buildFolderTree(filePaths);
    const repositorySummary = buildSummary(projectType, frameworks, languages, mergedPkg);

    const intelligence: RepositoryIntelligence = {
      repositoryId: `${owner}/${repo}`,
      owner,
      repo,
      branch: resolvedBranch,
      projectType,
      detectedLanguages: languages,
      detectedFrameworks: frameworks,
      detectedDatabases: databases,
      detectedORMs: orms,
      detectedTesting: testing,
      detectedStyling: styling,
      detectedStateManagement: stateManagement,
      packageManager,
      buildTools,
      lintingTools,
      formattingTools,
      importantFiles,
      folderTreeSummary,
      repositorySummary,
      generatedAt: new Date().toISOString(),
    };

    this.set(key, intelligence);
    return intelligence;
  }

  // ─── Readme Content ──────────────────────────────────────────────────────

  async getReadme(userId: string, owner: string, repo: string): Promise<string> {
    const key = cacheKey([owner, repo, 'readme']);
    const cached = this.get<string>(key);
    if (cached !== null && cached !== undefined) return cached;

    try {
      const octokit = await getOctokit(userId);
      const { data } = await octokit.rest.repos.getReadme({ owner, repo });
      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        this.set(key, content);
        return content;
      }
      return '';
    } catch {
      return '';
    }
  }

  // ─── Helper Methods ──────────────────────────────────────────────────────

  private buildFileTree(
    items: Array<{ path: string; type: string; size?: number }>,
    maxDepth: number = 4,
  ): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map = new Map<string, FileTreeNode>();

    const sorted = [...items].sort((a, b) => {
      if (a.type === 'tree' && b.type !== 'tree') return -1;
      if (a.type !== 'tree' && b.type === 'tree') return 1;
      return a.path.localeCompare(b.path);
    });

    for (const item of sorted) {
      const parts = item.path.split('/');
      if (parts.length > maxDepth + 1) continue;

      const name = parts[parts.length - 1];
      if (item.type === 'tree' && IGNORED_DIRS.has(name)) continue;
      if (item.type === 'tree' && name.startsWith('.') && name !== '.github') continue;

      const node: FileTreeNode = {
        path: item.path,
        name,
        type: item.type === 'tree' ? 'dir' : 'file',
        size: item.size,
      };

      map.set(item.path, node);

      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent && parent.type === 'dir') {
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      }
    }

    return root;
  }

  private countNodes(tree: FileTreeNode[]): { files: number; directories: number } {
    let files = 0;
    let directories = 0;
    const walk = (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'dir') {
          directories++;
          if (node.children) walk(node.children);
        } else {
          files++;
        }
      }
    };
    walk(tree);
    return { files, directories };
  }
}

// ─── Technology Detection Functions ──────────────────────────────────────────

function detectPackageJsonType(pkg: Record<string, unknown>): ProjectType {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) || {}),
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };
  const scripts = (pkg.scripts as Record<string, string>) || {};
  const name = (pkg.name as string) || '';

  if (name.includes('-cli') || scripts.bin || pkg.bin) return 'cli';
  if (
    deps['react'] ||
    deps['vue'] ||
    deps['angular'] ||
    deps['svelte'] ||
    deps['next'] ||
    deps['nuxt'] ||
    deps['@angular/core'] ||
    deps['astro']
  ) {
    if (
      deps['next'] ||
      deps['nuxt'] ||
      deps['@angular/core'] ||
      deps['astro'] ||
      deps['remix'] ||
      deps['@remix-run/react']
    )
      return 'web-app';
    if (scripts.build && (scripts.start || scripts.dev)) return 'web-app';
    return 'library';
  }
  if (deps['express'] || deps['fastify'] || deps['koa'] || deps['hono'] || deps['@nestjs/core'])
    return 'api';
  return 'unknown';
}

function detectPackageManager(filePaths: string[]): PackageManager {
  if (filePaths.some((p) => p === 'pnpm-lock.yaml' || p === 'pnpm-workspace.yaml')) return 'pnpm';
  if (filePaths.some((p) => p === 'yarn.lock')) return 'yarn';
  if (filePaths.some((p) => p === 'bun.lockb' || p === 'bun.lock')) return 'bun';
  if (filePaths.some((p) => p === 'package-lock.json')) return 'npm';
  return 'unknown';
}

function detectBuildTools(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (filePaths.some((p) => /vite\.config\./.test(p)))
    techs.push({ name: 'Vite', confidence: 'high', evidence: ['vite.config found'] });
  if (filePaths.some((p) => /webpack\.config\./.test(p)))
    techs.push({ name: 'Webpack', confidence: 'high', evidence: ['webpack.config found'] });
  if (filePaths.some((p) => /rollup\.config\./.test(p)))
    techs.push({ name: 'Rollup', confidence: 'high', evidence: ['rollup.config found'] });
  if (filePaths.some((p) => p === 'turbo.json'))
    techs.push({ name: 'Turborepo', confidence: 'high', evidence: ['turbo.json found'] });
  if (filePaths.some((p) => p === 'nx.json'))
    techs.push({ name: 'Nx', confidence: 'high', evidence: ['nx.json found'] });
  if (filePaths.some((p) => p === '.swcrc'))
    techs.push({ name: 'SWC', confidence: 'high', evidence: ['.swcrc found'] });
  if (deps['esbuild'])
    techs.push({ name: 'ESBuild', confidence: 'high', evidence: ['esbuild in dependencies'] });
  if (deps['tsc'] || deps['typescript'])
    techs.push({
      name: 'TypeScript',
      confidence: 'medium',
      evidence: ['typescript in dependencies'],
    });

  return techs;
}

function detectTestingFrameworks(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (filePaths.some((p) => /jest\.config\./.test(p)) || deps['jest'])
    techs.push({ name: 'Jest', confidence: 'high', evidence: ['jest config or dependency found'] });
  if (filePaths.some((p) => /vitest\.config\./.test(p)) || deps['vitest'])
    techs.push({
      name: 'Vitest',
      confidence: 'high',
      evidence: ['vitest config or dependency found'],
    });
  if (filePaths.some((p) => /cypress\.config\./.test(p)) || deps['cypress'])
    techs.push({
      name: 'Cypress',
      confidence: 'high',
      evidence: ['cypress config or dependency found'],
    });
  if (filePaths.some((p) => /playwright\.config\./.test(p)) || deps['@playwright/test'])
    techs.push({
      name: 'Playwright',
      confidence: 'high',
      evidence: ['playwright config or dependency found'],
    });
  if (
    deps['@testing-library/react'] ||
    deps['@testing-library/vue'] ||
    deps['@testing-library/svelte']
  )
    techs.push({
      name: 'Testing Library',
      confidence: 'high',
      evidence: ['testing-library in dependencies'],
    });
  if (deps['mocha'])
    techs.push({ name: 'Mocha', confidence: 'high', evidence: ['mocha in dependencies'] });

  return techs;
}

function detectLintingTools(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (
    filePaths.some(
      (p) =>
        /\.eslintrc/.test(p) ||
        p === 'eslint.config.js' ||
        p === 'eslint.config.mjs' ||
        p === 'eslint.config.ts',
    )
  ) {
    techs.push({ name: 'ESLint', confidence: 'high', evidence: ['eslint config found'] });
  } else if (deps['eslint']) {
    techs.push({ name: 'ESLint', confidence: 'medium', evidence: ['eslint in dependencies'] });
  }
  if (filePaths.some((p) => p === 'biome.json'))
    techs.push({ name: 'Biome', confidence: 'high', evidence: ['biome.json found'] });
  if (deps['oxlint'])
    techs.push({ name: 'oxlint', confidence: 'high', evidence: ['oxlint in dependencies'] });

  return techs;
}

function detectFormattingTools(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (
    filePaths.some(
      (p) => /\.prettierrc/.test(p) || p === 'prettier.config.js' || p === 'prettier.config.mts',
    )
  ) {
    techs.push({ name: 'Prettier', confidence: 'high', evidence: ['prettier config found'] });
  } else if (deps['prettier']) {
    techs.push({ name: 'Prettier', confidence: 'medium', evidence: ['prettier in dependencies'] });
  }
  if (filePaths.some((p) => p === 'biome.json') && !techs.some((t) => t.name === 'Biome')) {
    techs.push({ name: 'Biome', confidence: 'high', evidence: ['biome.json found'] });
  }

  return techs;
}

function detectFrameworks(
  _filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['react'])
    techs.push({ name: 'React', confidence: 'high', evidence: ['react in dependencies'] });
  if (deps['next'])
    techs.push({ name: 'Next.js', confidence: 'high', evidence: ['next in dependencies'] });
  if (deps['vue'])
    techs.push({ name: 'Vue', confidence: 'high', evidence: ['vue in dependencies'] });
  if (deps['nuxt'] || deps['nuxt3'])
    techs.push({ name: 'Nuxt', confidence: 'high', evidence: ['nuxt in dependencies'] });
  if (deps['@angular/core'])
    techs.push({
      name: 'Angular',
      confidence: 'high',
      evidence: ['@angular/core in dependencies'],
    });
  if (deps['svelte'])
    techs.push({ name: 'Svelte', confidence: 'high', evidence: ['svelte in dependencies'] });
  if (deps['sveltekit'] || deps['@sveltejs/kit'])
    techs.push({ name: 'SvelteKit', confidence: 'high', evidence: ['sveltekit in dependencies'] });
  if (deps['astro'])
    techs.push({ name: 'Astro', confidence: 'high', evidence: ['astro in dependencies'] });
  if (deps['remix'] || deps['@remix-run/react'] || deps['@remix-run/node'])
    techs.push({ name: 'Remix', confidence: 'high', evidence: ['remix in dependencies'] });
  if (deps['express'])
    techs.push({ name: 'Express', confidence: 'high', evidence: ['express in dependencies'] });
  if (deps['fastify'] || deps['@fastify/fastify'])
    techs.push({ name: 'Fastify', confidence: 'high', evidence: ['fastify in dependencies'] });
  if (deps['@nestjs/core'])
    techs.push({ name: 'NestJS', confidence: 'high', evidence: ['@nestjs/core in dependencies'] });
  if (deps['koa'])
    techs.push({ name: 'Koa', confidence: 'high', evidence: ['koa in dependencies'] });
  if (deps['hono'])
    techs.push({ name: 'Hono', confidence: 'high', evidence: ['hono in dependencies'] });

  return techs;
}

function detectDatabases(
  _filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['pg'] || deps['postgres'])
    techs.push({
      name: 'PostgreSQL',
      confidence: 'high',
      evidence: ['pg/postgres in dependencies'],
    });
  if (deps['mysql2'] || deps['mysql'])
    techs.push({ name: 'MySQL', confidence: 'high', evidence: ['mysql in dependencies'] });
  if (deps['mongodb'] || deps['mongoose'])
    techs.push({
      name: 'MongoDB',
      confidence: 'high',
      evidence: ['mongodb/mongoose in dependencies'],
    });
  if (deps['better-sqlite3'] || deps['sqlite3'])
    techs.push({ name: 'SQLite', confidence: 'high', evidence: ['sqlite in dependencies'] });
  if (deps['ioredis'] || deps['redis'])
    techs.push({ name: 'Redis', confidence: 'high', evidence: ['redis in dependencies'] });
  if (deps['@supabase/supabase-js'])
    techs.push({
      name: 'Supabase',
      confidence: 'high',
      evidence: ['@supabase/supabase-js in dependencies'],
    });
  if (deps['firebase'])
    techs.push({ name: 'Firebase', confidence: 'high', evidence: ['firebase in dependencies'] });

  return techs;
}

function detectORMs(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['prisma'] || filePaths.some((p) => p.startsWith('prisma/schema.prisma'))) {
    techs.push({
      name: 'Prisma',
      confidence: 'high',
      evidence: ['prisma in dependencies or schema found'],
    });
  }
  if (deps['drizzle-orm'] || filePaths.some((p) => /drizzle\.config\./.test(p))) {
    techs.push({
      name: 'Drizzle',
      confidence: 'high',
      evidence: ['drizzle-orm in dependencies or config found'],
    });
  }
  if (deps['mongoose'])
    techs.push({ name: 'Mongoose', confidence: 'high', evidence: ['mongoose in dependencies'] });
  if (deps['typeorm'])
    techs.push({ name: 'TypeORM', confidence: 'high', evidence: ['typeorm in dependencies'] });
  if (deps['sequelize'])
    techs.push({ name: 'Sequelize', confidence: 'high', evidence: ['sequelize in dependencies'] });
  if (deps['knex'])
    techs.push({ name: 'Knex', confidence: 'high', evidence: ['knex in dependencies'] });

  return techs;
}

function detectStyling(
  filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['tailwindcss'] || filePaths.some((p) => /tailwind\.config\./.test(p))) {
    techs.push({
      name: 'Tailwind CSS',
      confidence: 'high',
      evidence: ['tailwindcss in dependencies or config found'],
    });
  }
  if (deps['styled-components'])
    techs.push({
      name: 'Styled Components',
      confidence: 'high',
      evidence: ['styled-components in dependencies'],
    });
  if (deps['@emotion/react'] || deps['@emotion/styled'])
    techs.push({ name: 'Emotion', confidence: 'high', evidence: ['emotion in dependencies'] });
  if (deps['sass'] || deps['node-sass'])
    techs.push({ name: 'Sass', confidence: 'high', evidence: ['sass in dependencies'] });
  if (deps['bootstrap'] || deps['react-bootstrap'])
    techs.push({ name: 'Bootstrap', confidence: 'high', evidence: ['bootstrap in dependencies'] });
  if (deps['@mui/material'] || deps['@material-ui/core'])
    techs.push({ name: 'Material UI', confidence: 'high', evidence: ['MUI in dependencies'] });
  if (deps['@chakra-ui/react'])
    techs.push({ name: 'Chakra UI', confidence: 'high', evidence: ['chakra-ui in dependencies'] });
  if (
    deps['class-variance-authority'] ||
    deps['clsx'] ||
    filePaths.some((p) => /components\/ui\//.test(p))
  ) {
    techs.push({
      name: 'shadcn/ui',
      confidence: 'medium',
      evidence: ['shadcn/ui patterns detected'],
    });
  }

  return techs;
}

function detectStateManagement(
  _filePaths: string[],
  pkg: Record<string, unknown> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];
  const deps = pkg
    ? {
        ...((pkg.dependencies as Record<string, string>) || {}),
        ...((pkg.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['@reduxjs/toolkit'] || deps['react-redux'] || deps['redux']) {
    techs.push({ name: 'Redux', confidence: 'high', evidence: ['redux in dependencies'] });
  }
  if (deps['zustand'])
    techs.push({ name: 'Zustand', confidence: 'high', evidence: ['zustand in dependencies'] });
  if (deps['jotai'])
    techs.push({ name: 'Jotai', confidence: 'high', evidence: ['jotai in dependencies'] });
  if (deps['recoil'])
    techs.push({ name: 'Recoil', confidence: 'high', evidence: ['recoil in dependencies'] });
  if (deps['mobx'] || deps['mobx-react'])
    techs.push({ name: 'MobX', confidence: 'high', evidence: ['mobx in dependencies'] });
  if (deps['pinia'])
    techs.push({ name: 'Pinia', confidence: 'high', evidence: ['pinia in dependencies'] });
  if (deps['vuex'])
    techs.push({ name: 'Vuex', confidence: 'high', evidence: ['vuex in dependencies'] });

  return techs;
}

function detectLanguages(
  filePaths: string[],
  languageMap: Record<string, number> | null,
): DetectedTechnology[] {
  const techs: DetectedTechnology[] = [];

  if (languageMap) {
    const total = Object.values(languageMap).reduce((a, b) => a + b, 0);
    for (const [lang, bytes] of Object.entries(languageMap)) {
      const pct = total > 0 ? (bytes / total) * 100 : 0;
      if (pct < 0.5) continue;
      techs.push({
        name: lang,
        confidence: 'high',
        evidence: [`${pct.toFixed(1)}% of codebase`],
      });
    }
    return techs;
  }

  const extCounts: Record<string, number> = {};
  for (const p of filePaths) {
    const ext = p.split('.').pop()?.toLowerCase();
    if (ext) extCounts[ext] = (extCounts[ext] || 0) + 1;
  }

  const extMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    cs: 'C#',
    rb: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
    css: 'CSS',
    scss: 'CSS',
    html: 'HTML',
    md: 'Markdown',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    sh: 'Shell',
  };

  const langCounts: Record<string, number> = {};
  for (const [ext, count] of Object.entries(extCounts)) {
    const lang = extMap[ext];
    if (lang) langCounts[lang] = (langCounts[lang] || 0) + count;
  }

  const total = Object.values(langCounts).reduce((a, b) => a + b, 0);
  for (const [lang, count] of Object.entries(langCounts)) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    if (pct < 1) continue;
    techs.push({
      name: lang,
      confidence: pct > 5 ? 'high' : 'medium',
      evidence: [`${pct.toFixed(1)}% of files`],
    });
  }

  return techs.sort((a, b) => {
    const aPct = parseFloat(a.evidence[0]) || 0;
    const bPct = parseFloat(b.evidence[0]) || 0;
    return bPct - aPct;
  });
}

function detectImportantFiles(filePaths: string[]): ImportantFile[] {
  return IMPORTANT_FILES_PATTERNS.map(({ pattern, purpose }) => {
    const found = filePaths.some((p) => pattern.test(p));
    const path = filePaths.find((p) => pattern.test(p)) || '';
    return {
      path: path || pattern.source.replace(/\\\./g, '.').replace(/\^/, ''),
      purpose,
      exists: found,
    };
  }).filter((f) => f.exists);
}

function buildFolderTree(filePaths: string[], maxDepth = 3): FolderNode[] {
  const root: FolderNode[] = [];
  const topLevel = new Set<string>();

  for (const p of filePaths) {
    const parts = p.split('/');
    if (parts.length > 1) topLevel.add(parts[0]);
  }

  const ignored = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '__pycache__',
  ]);

  for (const top of topLevel) {
    if (ignored.has(top)) continue;
    const children: FolderNode[] = [];
    const subDirs = new Set<string>();

    for (const p of filePaths) {
      const parts = p.split('/');
      if (parts[0] !== top || parts.length < 2) continue;
      if (parts.length === 2) {
        children.push({ name: parts[1], type: 'file' });
      } else if (parts.length <= maxDepth + 1) {
        subDirs.add(parts[1]);
      }
    }

    for (const dir of subDirs) {
      children.push({ name: dir, type: 'directory' });
    }

    root.push({ name: top, type: 'directory', children: children.slice(0, 20) });
  }

  return root.slice(0, 30);
}

function buildSummary(
  projectType: ProjectType,
  frameworks: DetectedTechnology[],
  languages: DetectedTechnology[],
  pkg: Record<string, unknown> | null,
): string {
  const name = (pkg?.name as string) || 'repository';
  const fw = frameworks.map((f) => f.name).join(', ') || 'no frameworks detected';
  const lang =
    languages
      .slice(0, 3)
      .map((l) => l.name)
      .join(', ') || 'unknown languages';

  const typeLabel: Record<ProjectType, string> = {
    'web-app': 'Web application',
    api: 'API/backend service',
    library: 'Library/package',
    cli: 'CLI tool',
    mobile: 'Mobile app',
    monorepo: 'Monorepo',
    'static-site': 'Static site',
    unknown: 'Project',
  };

  return `${typeLabel[projectType]} (${name}) using ${fw}. Primary languages: ${lang}.`;
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const repositoryIntelligenceService = new RepositoryIntelligenceService();
