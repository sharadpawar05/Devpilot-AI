import { getOctokit } from '@/core/github';
import type {
  RepositoryIntelligence,
  DetectedTechnology,
  ImportantFile,
  FolderNode,
  ProjectType,
  PackageManager,
} from './types';

const IMPORTANT_FILES: { pattern: RegExp; purpose: string }[] = [
  { pattern: /^package\.json$/, purpose: 'Package manifest' },
  { pattern: /^pnpm-lock\.yaml$/, purpose: 'PNPM lockfile' },
  { pattern: /^yarn\.lock$/, purpose: 'Yarn lockfile' },
  { pattern: /^package-lock\.json$/, purpose: 'NPM lockfile' },
  { pattern: /^bun\.lockb?$/, purpose: 'Bun lockfile' },
  { pattern: /^tsconfig\.json$/, purpose: 'TypeScript config' },
  { pattern: /^tsconfig\.\w+\.json$/, purpose: 'TypeScript config (variant)' },
  { pattern: /^vite\.config\.(ts|js|mjs|mts)$/, purpose: 'Vite config' },
  { pattern: /^next\.config\.(ts|js|mjs)$/, purpose: 'Next.js config' },
  { pattern: /^nuxt\.config\.(ts|js|mjs)$/, purpose: 'Nuxt config' },
  { pattern: /^angular\.json$/, purpose: 'Angular config' },
  { pattern: /^svelte\.config\.(ts|js)$/, purpose: 'Svelte config' },
  { pattern: /^astro\.config\.(ts|js|mjs)$/, purpose: 'Astro config' },
  { pattern: /^remix\.config\.(ts|js|mjs)$/, purpose: 'Remix config' },
  { pattern: /^webpack\.config\.(ts|js|mjs)$/, purpose: 'Webpack config' },
  { pattern: /^rollup\.config\.(ts|js|mjs)$/, purpose: 'Rollup config' },
  { pattern: /^esbuild\.config\.(ts|js|mjs)$/, purpose: 'ESBuild config' },
  { pattern: /^turbo\.json$/, purpose: 'Turborepo config' },
  { pattern: /^nx\.json$/, purpose: 'Nx config' },
  { pattern: /^lerna\.json$/, purpose: 'Lerna config' },
  { pattern: /^pnpm-workspace\.yaml$/, purpose: 'PNPM workspace config' },
  { pattern: /^\.eslintrc\.(js|cjs|mjs|json|yaml|yml)$/, purpose: 'ESLint config' },
  { pattern: /^eslint\.config\.(js|cjs|mjs|ts)$/, purpose: 'ESLint flat config' },
  { pattern: /^\.prettierrc\.(js|cjs|mjs|json|yaml|yml)$/, purpose: 'Prettier config' },
  { pattern: /^prettier\.config\.(js|cjs|mts)$/, purpose: 'Prettier config' },
  { pattern: /^\.prettierignore$/, purpose: 'Prettier ignore' },
  { pattern: /^biome\.json$/, purpose: 'Biome config' },
  { pattern: /^jest\.config\.(ts|js|mjs|cjs)$/, purpose: 'Jest config' },
  { pattern: /^vitest\.config\.(ts|js|mjs)$/, purpose: 'Vitest config' },
  { pattern: /^cypress\.config\.(ts|js)$/, purpose: 'Cypress config' },
  { pattern: /^playwright\.config\.(ts|js)$/, purpose: 'Playwright config' },
  { pattern: /^Dockerfile$/, purpose: 'Dockerfile' },
  { pattern: /^Dockerfile\.\w+$/, purpose: 'Dockerfile (variant)' },
  { pattern: /^docker-compose\.(ya?ml|json)$/, purpose: 'Docker Compose' },
  { pattern: /^\.dockerignore$/, purpose: 'Docker ignore' },
  { pattern: /^\.env$/, purpose: 'Environment variables' },
  { pattern: /^\.env\.example$/, purpose: 'Environment variables (example)' },
  { pattern: /^\.env\.local$/, purpose: 'Local environment variables' },
  { pattern: /^README\.md$/, purpose: 'README' },
  { pattern: /^LICENSE$/, purpose: 'License' },
  { pattern: /^LICENSE\.\w+$/, purpose: 'License' },
  { pattern: /^\.gitignore$/, purpose: 'Git ignore' },
  { pattern: /^\.github\/workflows\/.+\.ya?ml$/, purpose: 'GitHub Actions workflow' },
  { pattern: /^prisma\/schema\.prisma$/, purpose: 'Prisma schema' },
  { pattern: /^drizzle\.config\.(ts|js)$/, purpose: 'Drizzle config' },
  { pattern: /^\.swcrc$/, purpose: 'SWC config' },
  { pattern: /^babel\.config\.(json|js|cjs|mjs)$/, purpose: 'Babel config' },
  { pattern: /^\.babelrc$/, purpose: 'Babel config' },
  { pattern: /^tailwind\.config\.(ts|js|cjs|mjs)$/, purpose: 'Tailwind config' },
  { pattern: /^postcss\.config\.(ts|js|cjs|mjs)$/, purpose: 'PostCSS config' },
  { pattern: /^\.stylelintrc/, purpose: 'Stylelint config' },
  { pattern: /^supabase\/config\.toml$/, purpose: 'Supabase config' },
];

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

  // Frontend
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

  // Backend
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
  return IMPORTANT_FILES.map(({ pattern, purpose }) => {
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

export class IntelligenceService {
  private cache = new Map<string, { data: RepositoryIntelligence; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(owner: string, repo: string, branch: string): string {
    return `${owner}/${repo}@${branch}`;
  }

  private getCached(owner: string, repo: string, branch: string): RepositoryIntelligence | null {
    const key = this.getCacheKey(owner, repo, branch);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data;
    this.cache.delete(key);
    return null;
  }

  private setCache(
    owner: string,
    repo: string,
    branch: string,
    data: RepositoryIntelligence,
  ): void {
    const key = this.getCacheKey(owner, repo, branch);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(owner: string, repo: string, branch?: string): void {
    if (branch) {
      this.cache.delete(this.getCacheKey(owner, repo, branch));
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${owner}/${repo}@`)) this.cache.delete(key);
      }
    }
  }

  async analyze(
    userId: string,
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<RepositoryIntelligence> {
    const octokit = await getOctokit(userId);

    // Resolve branch
    let resolvedBranch = branch || 'main';
    if (!branch) {
      try {
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        resolvedBranch = repoData.default_branch;
      } catch {
        // use default
      }
    }

    // Check cache
    const cached = this.getCached(owner, repo, resolvedBranch);
    if (cached) return cached;

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
      // Fallback: try getting the tree from the repo
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
      resolvedBranch = repoData.default_branch;
    }

    const filePaths = tree.map((e) => e.path);

    // Fetch key files for content analysis
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
          // file doesn't exist
        }
      }),
    );

    // Also try to find nested package.json files (monorepo)
    const pkgPaths = filePaths.filter(
      (p) => p.endsWith('/package.json') && !p.includes('node_modules'),
    );
    await Promise.all(
      pkgPaths.slice(0, 5).map(async (path) => {
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
          // ignore
        }
      }),
    );

    // Merge all dependencies from all package.json files
    const mergedDeps: Record<string, string> = {};
    const mergedDevDeps: Record<string, string> = {};
    for (const pkg of packageJsons.values()) {
      const deps = (pkg.dependencies as Record<string, string>) || {};
      const devDeps = (pkg.devDependencies as Record<string, string>) || {};
      Object.assign(mergedDeps, deps);
      Object.assign(mergedDevDeps, devDeps);
    }
    const mergedPkg: Record<string, unknown> | null =
      packageJsons.size > 0
        ? {
            dependencies: mergedDeps,
            devDependencies: mergedDevDeps,
            ...((packageJsons.get('root') || {}) as Record<string, unknown>),
          }
        : null;

    // Run all detections
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

    this.setCache(owner, repo, resolvedBranch, intelligence);
    return intelligence;
  }
}

export const intelligenceService = new IntelligenceService();
