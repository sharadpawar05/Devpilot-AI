import { getOctokit } from '@/core/github';
import type {
  RepoOverviewMetadata,
  RepoFileNode,
  RepoLanguageBreakdown,
  RepoContributor,
  RepoOverviewData,
  RepoHealthDetail,
} from './types';

const MAX_TREE_DEPTH = 4;
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

function buildTree(
  items: Array<{ path: string; type: string; size?: number }>,
  maxDepth: number = MAX_TREE_DEPTH,
): RepoFileNode[] {
  const root: RepoFileNode[] = [];
  const map = new Map<string, RepoFileNode>();

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

    const node: RepoFileNode = {
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

function countNodes(tree: RepoFileNode[]): { files: number; directories: number } {
  let files = 0;
  let directories = 0;
  function walk(nodes: RepoFileNode[]) {
    for (const node of nodes) {
      if (node.type === 'dir') {
        directories++;
        if (node.children) walk(node.children);
      } else {
        files++;
      }
    }
  }
  walk(tree);
  return { files, directories };
}

export class RepoOverviewService {
  async getOverview(userId: string, owner: string, repo: string): Promise<RepoOverviewData> {
    const octokit = await getOctokit(userId);

    const [repoData, treeData, languages, contributors] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.git
        .getTree({ owner, repo, tree_sha: 'HEAD', recursive: 'true' })
        .catch(() => null),
      octokit.rest.repos
        .listLanguages({ owner, repo })
        .catch(() => ({ data: {} as RepoLanguageBreakdown })),
      octokit.rest.repos
        .listContributors({ owner, repo, per_page: 10 })
        .catch(() => ({ data: [] as RepoContributor[] })),
    ]);

    const metadata: RepoOverviewMetadata = {
      id: repoData.data.id,
      name: repoData.data.name,
      full_name: repoData.data.full_name,
      description: repoData.data.description,
      html_url: repoData.data.html_url,
      default_branch: repoData.data.default_branch,
      visibility: repoData.data.visibility as 'public' | 'private',
      size: repoData.data.size,
      stargazers_count: repoData.data.stargazers_count,
      forks_count: repoData.data.forks_count,
      open_issues_count: repoData.data.open_issues_count,
      watchers_count: repoData.data.watchers_count,
      language: repoData.data.language,
      license: repoData.data.license
        ? { spdx_id: repoData.data.license.spdx_id || '', name: repoData.data.license.name || '' }
        : null,
      topics: repoData.data.topics || [],
      created_at: repoData.data.created_at,
      updated_at: repoData.data.updated_at,
      pushed_at: repoData.data.pushed_at,
      owner: {
        login: repoData.data.owner.login,
        avatar_url: repoData.data.owner.avatar_url || '',
      },
    };

    let tree: RepoFileNode[] = [];
    if (treeData?.data?.tree) {
      tree = buildTree(treeData.data.tree as Array<{ path: string; type: string; size?: number }>);
    }

    const { files: totalFiles, directories: totalDirectories } = countNodes(tree);

    const contributorList: RepoContributor[] = (contributors.data || []).map((c) => ({
      login: c.login || '',
      avatar_url: c.avatar_url || '',
      contributions: c.contributions,
    }));

    const fileNames = treeData?.data?.tree
      ? (treeData.data.tree as Array<{ path: string; type: string }>)
          .filter((i) => i.type === 'blob')
          .map((i) => i.path.split('/').pop() || '')
      : [];

    const health = this.computeHealth(fileNames, totalFiles, totalDirectories);

    return {
      metadata,
      tree,
      languages: languages.data as RepoLanguageBreakdown,
      contributors: contributorList,
      health,
      totalFiles,
      totalDirectories,
    };
  }

  private computeHealth(
    fileNames: string[],
    _totalFiles: number,
    _totalDirectories: number,
  ): RepoOverviewData['health'] {
    const flatNames = fileNames.map((f) => f.toLowerCase());

    const hasReadme = flatNames.some(
      (n) => n === 'readme.md' || n === 'readme.rst' || n === 'readme.txt',
    );
    const hasLicense = flatNames.some(
      (n) => n === 'license' || n === 'license.md' || n === 'license.txt' || n === 'license.mit',
    );
    const hasPackageJson = flatNames.includes('package.json');
    const hasGitHubActions = fileNames.some(
      (n) => n.includes('.github/workflows') || n.startsWith('.github/'),
    );
    const hasDockerfile =
      flatNames.includes('dockerfile') ||
      flatNames.includes('docker-compose.yml') ||
      flatNames.includes('docker-compose.yaml');
    const hasEnvExample = flatNames.some(
      (n) => n === '.env.example' || n === '.env.sample' || n === '.env.template',
    );
    const hasGitignore = flatNames.includes('.gitignore');
    const hasTests = fileNames.some(
      (n) =>
        n.includes('.test.') ||
        n.includes('.spec.') ||
        n.includes('__tests__') ||
        n.includes('test/'),
    );
    const hasCI =
      hasGitHubActions ||
      fileNames.some(
        (n) => n.includes('.travis.yml') || n.includes('Jenkinsfile') || n.includes('.circleci'),
      );
    const hasDocumentation = fileNames.some(
      (n) => n.includes('docs/') || n.includes('CONTRIBUTING.md') || n.includes('CHANGELOG.md'),
    );

    const details: RepoHealthDetail[] = [
      {
        name: 'README',
        passed: hasReadme,
        severity: 'high',
        failedDescription: 'No README found',
        whyItMatters:
          'A README is the first thing contributors read. Without one, people cannot understand your project purpose, how to set it up, or how to contribute.',
        recommendation:
          'Add a README.md with project description, installation steps, usage examples, and contribution guidelines.',
        estimatedEffort: '10–15 minutes',
        actionLabel: 'Generate README',
        actionType: 'generate-readme',
        scorePenalty: hasReadme ? 0 : 20,
      },
      {
        name: 'License',
        passed: hasLicense,
        severity: 'medium',
        failedDescription: 'No LICENSE file found',
        whyItMatters:
          'Without a license, your code is not legally open source. Others have no permission to use, modify, or distribute your work.',
        recommendation:
          'Add a LICENSE file. MIT and Apache 2.0 are popular choices for open-source projects.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate LICENSE',
        actionType: 'generate-license',
        scorePenalty: hasLicense ? 0 : 10,
      },
      {
        name: 'Gitignore',
        passed: hasGitignore,
        severity: 'low',
        failedDescription: 'No .gitignore found',
        whyItMatters:
          'Without a .gitignore, build artifacts, dependencies, and secrets may be accidentally committed to version control.',
        recommendation:
          'Add a .gitignore to exclude node_modules, dist, .env, and other generated files.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate .gitignore',
        actionType: 'generate-gitignore',
        scorePenalty: hasGitignore ? 0 : 5,
      },
      {
        name: 'Package Config',
        passed: hasPackageJson,
        severity: 'medium',
        failedDescription: 'No package.json detected',
        whyItMatters:
          'A package.json defines dependencies, scripts, and project metadata. Without it, builds are not reproducible and onboarding is difficult.',
        recommendation:
          'Add a package.json with dependencies, scripts (build, test, lint), and project metadata.',
        estimatedEffort: '5–10 minutes',
        actionLabel: 'Generate package.json',
        actionType: 'generate-package-json',
        scorePenalty: hasPackageJson ? 0 : 10,
      },
      {
        name: 'CI/CD',
        passed: hasCI,
        severity: 'high',
        failedDescription: 'No GitHub Actions workflow detected',
        whyItMatters:
          'Without CI/CD, code quality checks only happen manually. Regressions go undetected until they reach production.',
        recommendation:
          'Configure a GitHub Actions workflow under .github/workflows/ for automated testing, linting, and deployment.',
        estimatedEffort: '15–30 minutes',
        actionLabel: 'Generate CI Workflow',
        actionType: 'generate-ci',
        scorePenalty: hasCI ? 0 : 15,
      },
      {
        name: 'Tests',
        passed: hasTests,
        severity: 'high',
        failedDescription: 'No test files detected',
        whyItMatters:
          'Without automated tests, regressions are more likely during development. Code changes cannot be verified with confidence.',
        recommendation:
          'Set up Vitest or Jest and add unit tests for critical business logic and components.',
        estimatedEffort: '30–60 minutes',
        actionLabel: 'Generate Test Setup',
        actionType: 'generate-tests',
        scorePenalty: hasTests ? 0 : 20,
      },
      {
        name: 'Documentation',
        passed: hasDocumentation,
        severity: 'medium',
        failedDescription: 'Additional documentation not found',
        whyItMatters:
          'A README alone is often not enough. Without a docs/ folder, CONTRIBUTING.md, or CHANGELOG, contributors lack context on conventions and project history.',
        recommendation:
          'Add a docs/ directory, CONTRIBUTING.md, or CHANGELOG.md to supplement the README.',
        estimatedEffort: '15–30 minutes',
        actionLabel: 'Generate Docs',
        actionType: 'generate-docs',
        scorePenalty: hasDocumentation ? 0 : 10,
      },
      {
        name: 'Docker',
        passed: hasDockerfile,
        severity: 'low',
        failedDescription: 'No Dockerfile found',
        whyItMatters:
          'Without a Dockerfile, contributors may face "works on my machine" issues. Containerization ensures consistent environments.',
        recommendation:
          'Add a Dockerfile and optionally a docker-compose.yml for local development.',
        estimatedEffort: '10–15 minutes',
        actionLabel: 'Generate Dockerfile',
        actionType: 'generate-dockerfile',
        scorePenalty: hasDockerfile ? 0 : 5,
      },
      {
        name: 'Env Example',
        passed: hasEnvExample,
        severity: 'low',
        failedDescription: 'No .env.example found',
        whyItMatters:
          'New contributors have no way to know which environment variables are required. This leads to runtime errors and wasted setup time.',
        recommendation:
          'Add a .env.example listing all required environment variables with placeholder values.',
        estimatedEffort: 'Less than 1 minute',
        actionLabel: 'Generate .env.example',
        actionType: 'generate-env-example',
        scorePenalty: hasEnvExample ? 0 : 5,
      },
    ];

    const totalPossible = 100;
    const totalPenalty = details.reduce((sum, d) => sum + d.scorePenalty, 0);
    const score = Math.max(0, totalPossible - totalPenalty);

    const passedCount = details.filter((d) => d.passed).length;
    const failedCount = details.filter((d) => !d.passed).length;
    const criticalCount = details.filter((d) => !d.passed && d.severity === 'critical').length;

    const scoreBreakdown = details
      .filter((d) => !d.passed && d.scorePenalty > 0)
      .map((d) => ({ name: d.name, penalty: d.scorePenalty }));

    return {
      score,
      passedCount,
      failedCount,
      criticalCount,
      details,
      scoreBreakdown,
    };
  }
}

export const repoOverviewService = new RepoOverviewService();
