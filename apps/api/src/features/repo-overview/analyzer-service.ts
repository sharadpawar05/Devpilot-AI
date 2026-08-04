import { getOctokit } from '@/core/github';

export type TechCategory =
  | 'architecture'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'orm'
  | 'styling'
  | 'testing'
  | 'linting'
  | 'ai'
  | 'authentication'
  | 'deployment'
  | 'packageManager'
  | 'buildTool'
  | 'runtime';

export interface DetectedTech {
  name: string;
  version?: string;
  confidence: number;
  source: string;
}

export interface TechnologyStack {
  architecture: DetectedTech[];
  frontend: DetectedTech[];
  backend: DetectedTech[];
  database: DetectedTech[];
  orm: DetectedTech[];
  styling: DetectedTech[];
  testing: DetectedTech[];
  linting: DetectedTech[];
  ai: DetectedTech[];
  authentication: DetectedTech[];
  deployment: DetectedTech[];
  packageManager: DetectedTech[];
  buildTool: DetectedTech[];
  runtime: DetectedTech[];
}

interface DetectionRule {
  name: string;
  category: TechCategory;
  confidence: number;
  source: string;
  detect: (ctx: DetectionContext) => DetectedTech | null;
}

interface DetectionContext {
  filePaths: string[];
  fileContents: Map<string, string>;
  packageJsons: Array<{ path: string; data: Record<string, unknown> }>;
}

function stripVersionPrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, '').trim();
}

function hasDep(packageJsons: Array<{ data: Record<string, unknown> }>, deps: string[]): boolean {
  for (const pj of packageJsons) {
    const allDeps: Record<string, string> = {
      ...((pj.data.dependencies as Record<string, string>) || {}),
      ...((pj.data.devDependencies as Record<string, string>) || {}),
      ...((pj.data.peerDependencies as Record<string, string>) || {}),
    };
    if (deps.some((d) => d in allDeps)) return true;
  }
  return false;
}

function getDepVersion(
  packageJsons: Array<{ data: Record<string, unknown> }>,
  deps: string[],
): string | undefined {
  for (const pj of packageJsons) {
    const allDeps: Record<string, string> = {
      ...((pj.data.dependencies as Record<string, string>) || {}),
      ...((pj.data.devDependencies as Record<string, string>) || {}),
      ...((pj.data.peerDependencies as Record<string, string>) || {}),
    };
    for (const d of deps) {
      if (d in allDeps) return stripVersionPrefix(allDeps[d]);
    }
  }
  return undefined;
}

function hasFile(filePaths: string[], patterns: string[]): boolean {
  const lower = filePaths.map((f) => f.toLowerCase());
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

const RELEVANT_FILE_EXTENSIONS = new Set([
  'json',
  'yaml',
  'yml',
  'toml',
  'lock',
  'mod',
  'xml',
  'gradle',
  'cs',
  'csproj',
  'sln',
]);

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'lockb',
  'bin',
  'exe',
  'so',
  'dylib',
  'pdf',
  'zip',
  'tar',
  'gz',
]);

function isRelevantFile(path: string): boolean {
  const name = path.split('/').pop() || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (BINARY_EXTENSIONS.has(ext)) return false;

  if (
    name === 'package.json' ||
    name === 'turbo.json' ||
    name === 'nx.json' ||
    name === 'lerna.json' ||
    name === 'pnpm-workspace.yaml' ||
    name === 'deno.json' ||
    name === 'deno.jsonc' ||
    name === 'bun.lockb' ||
    name === 'go.mod' ||
    name === 'Cargo.toml' ||
    name === 'pom.xml' ||
    name === 'build.gradle' ||
    name === 'requirements.txt' ||
    name === 'pyproject.toml' ||
    name === 'Dockerfile' ||
    name === 'docker-compose.yml' ||
    name === 'docker-compose.yaml' ||
    name === 'docker-compose.json' ||
    name === 'README.md' ||
    name === 'readme.md' ||
    name === '.nvmrc' ||
    name === '.node-version' ||
    name === '.tool-versions'
  ) {
    return true;
  }

  if (
    name.endsWith('.config.js') ||
    name.endsWith('.config.ts') ||
    name.endsWith('.config.mjs') ||
    name.endsWith('.config.cjs') ||
    name.endsWith('.config.mts') ||
    name.endsWith('.config.cts') ||
    name.endsWith('.config.json')
  ) {
    return true;
  }

  if (
    name === '.eslintrc.js' ||
    name === '.eslintrc.json' ||
    name === '.eslintrc.yml' ||
    name === '.prettierrc' ||
    name === '.prettierrc.json' ||
    name === '.prettierrc.js' ||
    name === 'biome.json' ||
    name === 'commitlint.config.js'
  ) {
    return true;
  }

  if (name === 'pnpm-lock.yaml' || name === 'yarn.lock' || name === 'package-lock.json') {
    return true;
  }

  if (path.includes('.github/workflows/') && (name.endsWith('.yml') || name.endsWith('.yaml'))) {
    return true;
  }

  if (name.endsWith('.csproj') || name.endsWith('.sln')) return true;

  return RELEVANT_FILE_EXTENSIONS.has(ext);
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const rules: DetectionRule[] = [
  // Architecture
  {
    name: 'Monorepo',
    category: 'architecture',
    confidence: 95,
    source: 'turbo.json / nx.json / lerna.json / pnpm-workspace.yaml',
    detect: (ctx) => {
      if (hasFile(ctx.filePaths, ['turbo.json']))
        return { name: 'Turborepo Monorepo', confidence: 95, source: 'turbo.json' };
      if (hasFile(ctx.filePaths, ['nx.json']))
        return { name: 'Nx Monorepo', confidence: 95, source: 'nx.json' };
      if (hasFile(ctx.filePaths, ['lerna.json']))
        return { name: 'Lerna Monorepo', confidence: 95, source: 'lerna.json' };
      if (hasFile(ctx.filePaths, ['pnpm-workspace.yaml']))
        return { name: 'pnpm Workspaces Monorepo', confidence: 95, source: 'pnpm-workspace.yaml' };
      return null;
    },
  },
  {
    name: 'Monorepo (workspaces)',
    category: 'architecture',
    confidence: 85,
    source: 'package.json workspaces field',
    detect: (ctx) => {
      for (const pj of ctx.packageJsons) {
        if (pj.data.workspaces)
          return { name: 'npm/Yarn Workspaces Monorepo', confidence: 85, source: pj.path };
      }
      return null;
    },
  },

  // Frontend
  {
    name: 'React',
    category: 'frontend',
    confidence: 95,
    source: 'react dependency',
    detect: (ctx) => {
      const version = getDepVersion(ctx.packageJsons, ['react', 'react-dom']);
      return { name: 'React', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Next.js',
    category: 'frontend',
    confidence: 100,
    source: 'next dependency + next.config',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['next'])) return null;
      const hasConfig = hasFile(ctx.filePaths, [
        'next.config.js',
        'next.config.mjs',
        'next.config.ts',
        'next.config.cjs',
      ]);
      const version = getDepVersion(ctx.packageJsons, ['next']);
      return { name: 'Next.js', version, confidence: hasConfig ? 100 : 90, source: 'package.json' };
    },
  },
  {
    name: 'Vue',
    category: 'frontend',
    confidence: 95,
    source: 'vue dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['vue'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['vue']);
      return { name: 'Vue.js', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Nuxt',
    category: 'frontend',
    confidence: 100,
    source: 'nuxt dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['nuxt'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['nuxt']);
      return { name: 'Nuxt', version, confidence: 100, source: 'package.json' };
    },
  },
  {
    name: 'Angular',
    category: 'frontend',
    confidence: 100,
    source: '@angular/core dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@angular/core'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@angular/core']);
      return { name: 'Angular', version, confidence: 100, source: 'package.json' };
    },
  },
  {
    name: 'Svelte',
    category: 'frontend',
    confidence: 95,
    source: 'svelte dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['svelte'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['svelte']);
      return { name: 'Svelte', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'React Native',
    category: 'frontend',
    confidence: 95,
    source: 'react-native dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['react-native'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['react-native']);
      return { name: 'React Native', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Expo',
    category: 'frontend',
    confidence: 95,
    source: 'expo dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['expo'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['expo']);
      return { name: 'Expo', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Vue Router',
    category: 'frontend',
    confidence: 90,
    source: 'vue-router dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['vue-router', '@vue/router'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['vue-router', '@vue/router']);
      return { name: 'Vue Router', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'TanStack Router',
    category: 'frontend',
    confidence: 90,
    source: '@tanstack/react-router dependency',
    detect: (ctx) => {
      const deps = ['@tanstack/react-router', '@tanstack/vue-router', '@tanstack/solid-router'];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, deps);
      return { name: 'TanStack Router', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'TanStack Query',
    category: 'frontend',
    confidence: 90,
    source: '@tanstack/react-query dependency',
    detect: (ctx) => {
      const deps = [
        '@tanstack/react-query',
        '@tanstack/vue-query',
        '@tanstack/solid-query',
        '@tanstack/angular-query-experimental',
      ];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, deps);
      return { name: 'TanStack Query', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Redux',
    category: 'frontend',
    confidence: 90,
    source: 'redux / @reduxjs/toolkit dependency',
    detect: (ctx) => {
      const deps = ['redux', '@reduxjs/toolkit', 'react-redux'];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, ['@reduxjs/toolkit', 'redux']);
      return { name: 'Redux/RTK', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Zustand',
    category: 'frontend',
    confidence: 90,
    source: 'zustand dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['zustand'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['zustand']);
      return { name: 'Zustand', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Jotai',
    category: 'frontend',
    confidence: 90,
    source: 'jotai dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['jotai'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['jotai']);
      return { name: 'Jotai', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'React Hook Form',
    category: 'frontend',
    confidence: 90,
    source: 'react-hook-form dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['react-hook-form'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['react-hook-form']);
      return { name: 'React Hook Form', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Zod',
    category: 'frontend',
    confidence: 90,
    source: 'zod dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['zod'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['zod']);
      return { name: 'Zod', version, confidence: 90, source: 'package.json' };
    },
  },

  // Backend
  {
    name: 'Express',
    category: 'backend',
    confidence: 95,
    source: 'express dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['express'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['express']);
      return { name: 'Express', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Fastify',
    category: 'backend',
    confidence: 95,
    source: 'fastify dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['fastify'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['fastify']);
      return { name: 'Fastify', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'NestJS',
    category: 'backend',
    confidence: 100,
    source: '@nestjs/core dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@nestjs/core'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@nestjs/core']);
      return { name: 'NestJS', version, confidence: 100, source: 'package.json' };
    },
  },
  {
    name: 'Hono',
    category: 'backend',
    confidence: 95,
    source: 'hono dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['hono'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['hono']);
      return { name: 'Hono', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'tRPC',
    category: 'backend',
    confidence: 95,
    source: '@trpc/server dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@trpc/server'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@trpc/server']);
      return { name: 'tRPC', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'GraphQL',
    category: 'backend',
    confidence: 95,
    source: 'graphql / apollo dependency',
    detect: (ctx) => {
      const deps = ['graphql', '@apollo/server', 'apollo-server', '@apollo/client'];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, ['@apollo/server', 'graphql']);
      return { name: 'GraphQL', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Python',
    category: 'backend',
    confidence: 95,
    source: 'requirements.txt / pyproject.toml',
    detect: (ctx) => {
      if (
        hasFile(ctx.filePaths, [
          'requirements.txt',
          'pyproject.toml',
          'setup.py',
          'setup.cfg',
          'Pipfile',
        ])
      ) {
        return { name: 'Python', confidence: 95, source: 'file detection' };
      }
      return null;
    },
  },
  {
    name: 'Go',
    category: 'backend',
    confidence: 100,
    source: 'go.mod',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['go.mod'])) return null;
      const content = ctx.fileContents.get('go.mod') || '';
      const match = content.match(/^go\s+(\d+\.\d+)/m);
      return { name: 'Go', version: match?.[1], confidence: 100, source: 'go.mod' };
    },
  },
  {
    name: 'Rust',
    category: 'backend',
    confidence: 100,
    source: 'Cargo.toml',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['Cargo.toml'])) return null;
      const content = ctx.fileContents.get('Cargo.toml') || '';
      const match = content.match(/^edition\s*=\s*"(\d{4})"/m);
      return { name: 'Rust', version: match?.[1], confidence: 100, source: 'Cargo.toml' };
    },
  },
  {
    name: 'Java',
    category: 'backend',
    confidence: 100,
    source: 'pom.xml / build.gradle',
    detect: (ctx) => {
      if (hasFile(ctx.filePaths, ['pom.xml']))
        return { name: 'Java', confidence: 100, source: 'pom.xml' };
      if (hasFile(ctx.filePaths, ['build.gradle', 'build.gradle.kts']))
        return { name: 'Java/Kotlin', confidence: 100, source: 'build.gradle' };
      return null;
    },
  },
  {
    name: '.NET',
    category: 'backend',
    confidence: 100,
    source: '.csproj / .sln',
    detect: (ctx) => {
      if (hasFile(ctx.filePaths, ['*.csproj', '*.sln']))
        return { name: '.NET', confidence: 100, source: 'project file' };
      const hasDotNet = ctx.filePaths.some((f) => f.endsWith('.csproj') || f.endsWith('.sln'));
      if (hasDotNet) return { name: '.NET', confidence: 100, source: 'project file' };
      return null;
    },
  },

  // Database
  {
    name: 'PostgreSQL',
    category: 'database',
    confidence: 95,
    source: 'pg / postgres dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['pg', 'postgres'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['pg', 'postgres']);
      return { name: 'PostgreSQL', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'MySQL',
    category: 'database',
    confidence: 95,
    source: 'mysql2 dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['mysql2', 'mysql'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['mysql2', 'mysql']);
      return { name: 'MySQL', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'MongoDB',
    category: 'database',
    confidence: 95,
    source: 'mongodb / mongoose dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['mongodb', 'mongoose'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['mongodb', 'mongoose']);
      return { name: 'MongoDB', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'SQLite',
    category: 'database',
    confidence: 95,
    source: 'better-sqlite3 dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['better-sqlite3', 'sqlite3', 'sql.js'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['better-sqlite3', 'sqlite3', 'sql.js']);
      return { name: 'SQLite', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Supabase',
    category: 'database',
    confidence: 95,
    source: '@supabase/supabase-js dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@supabase/supabase-js'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@supabase/supabase-js']);
      return { name: 'Supabase', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Firebase',
    category: 'database',
    confidence: 95,
    source: 'firebase dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['firebase', '@firebase/app'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['firebase']);
      return { name: 'Firebase', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Redis',
    category: 'database',
    confidence: 95,
    source: 'redis / ioredis dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['redis', 'ioredis'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['redis', 'ioredis']);
      return { name: 'Redis', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'PlanetScale',
    category: 'database',
    confidence: 90,
    source: '@planetscale/database dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@planetscale/database'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@planetscale/database']);
      return { name: 'PlanetScale', version, confidence: 90, source: 'package.json' };
    },
  },

  // ORM
  {
    name: 'Prisma',
    category: 'orm',
    confidence: 100,
    source: 'prisma dependency / prisma schema',
    detect: (ctx) => {
      const hasPrisma =
        hasDep(ctx.packageJsons, ['prisma', '@prisma/client']) ||
        hasFile(ctx.filePaths, ['prisma/schema.prisma', 'schema.prisma']);
      if (!hasPrisma) return null;
      const version = getDepVersion(ctx.packageJsons, ['prisma', '@prisma/client']);
      return { name: 'Prisma', version, confidence: 100, source: 'package.json / schema' };
    },
  },
  {
    name: 'Drizzle',
    category: 'orm',
    confidence: 100,
    source: 'drizzle-orm dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['drizzle-orm', 'drizzle-kit'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['drizzle-orm']);
      return { name: 'Drizzle', version, confidence: 100, source: 'package.json' };
    },
  },
  {
    name: 'TypeORM',
    category: 'orm',
    confidence: 95,
    source: 'typeorm dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['typeorm'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['typeorm']);
      return { name: 'TypeORM', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Sequelize',
    category: 'orm',
    confidence: 95,
    source: 'sequelize dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['sequelize'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['sequelize']);
      return { name: 'Sequelize', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Mongoose',
    category: 'orm',
    confidence: 95,
    source: 'mongoose dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['mongoose'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['mongoose']);
      return { name: 'Mongoose', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Kysely',
    category: 'orm',
    confidence: 95,
    source: 'kysely dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['kysely'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['kysely']);
      return { name: 'Kysely', version, confidence: 95, source: 'package.json' };
    },
  },

  // Styling
  {
    name: 'Tailwind CSS',
    category: 'styling',
    confidence: 95,
    source: 'tailwindcss dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['tailwindcss']) ||
        hasFile(ctx.filePaths, [
          'tailwind.config.js',
          'tailwind.config.ts',
          'tailwind.config.mjs',
          'tailwind.config.cjs',
        ]);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['tailwindcss']);
      return { name: 'Tailwind CSS', version, confidence: 95, source: 'package.json / config' };
    },
  },
  {
    name: 'Material UI',
    category: 'styling',
    confidence: 95,
    source: '@mui/material dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@mui/material', '@mui/icons-material'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@mui/material']);
      return { name: 'Material UI', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Chakra UI',
    category: 'styling',
    confidence: 95,
    source: '@chakra-ui/react dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@chakra-ui/react', '@chakra-ui/core'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@chakra-ui/react']);
      return { name: 'Chakra UI', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'shadcn/ui',
    category: 'styling',
    confidence: 90,
    source: 'class-variance-authority + clsx + tailwind-merge',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['class-variance-authority']) &&
        hasDep(ctx.packageJsons, ['clsx', 'tailwind-merge']);
      if (!has) return null;
      return { name: 'shadcn/ui', confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Styled Components',
    category: 'styling',
    confidence: 95,
    source: 'styled-components dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['styled-components'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['styled-components']);
      return { name: 'Styled Components', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Sass',
    category: 'styling',
    confidence: 95,
    source: 'sass dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['sass', 'node-sass'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['sass', 'node-sass']);
      return { name: 'Sass', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'PostCSS',
    category: 'styling',
    confidence: 90,
    source: 'postcss dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['postcss']) ||
        hasFile(ctx.filePaths, ['postcss.config.js', 'postcss.config.ts', 'postcss.config.mjs']);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['postcss']);
      return { name: 'PostCSS', version, confidence: 90, source: 'package.json / config' };
    },
  },

  // Testing
  {
    name: 'Jest',
    category: 'testing',
    confidence: 95,
    source: 'jest dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['jest'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['jest']);
      return { name: 'Jest', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Vitest',
    category: 'testing',
    confidence: 95,
    source: 'vitest dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['vitest'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['vitest']);
      return { name: 'Vitest', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Playwright',
    category: 'testing',
    confidence: 95,
    source: '@playwright/test dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@playwright/test', 'playwright'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@playwright/test', 'playwright']);
      return { name: 'Playwright', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Cypress',
    category: 'testing',
    confidence: 95,
    source: 'cypress dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['cypress'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['cypress']);
      return { name: 'Cypress', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'React Testing Library',
    category: 'testing',
    confidence: 90,
    source: '@testing-library/react dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@testing-library/react'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@testing-library/react']);
      return { name: 'React Testing Library', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Storybook',
    category: 'testing',
    confidence: 90,
    source: 'storybook dependency / .storybook config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, [
          '@storybook/react',
          '@storybook/nextjs',
          '@storybook/vue3',
          'storybook',
        ]) ||
        hasFile(ctx.filePaths, ['.storybook/main.js', '.storybook/main.ts', '.storybook/main.mjs']);
      if (!has) return null;
      return { name: 'Storybook', confidence: 90, source: 'package.json / config' };
    },
  },

  // Linting
  {
    name: 'ESLint',
    category: 'linting',
    confidence: 95,
    source: 'eslint dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['eslint']) ||
        hasFile(ctx.filePaths, [
          '.eslintrc.js',
          '.eslintrc.json',
          '.eslintrc.yml',
          '.eslintrc.cjs',
          'eslint.config.js',
          'eslint.config.mjs',
          'eslint.config.ts',
        ]);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['eslint']);
      return { name: 'ESLint', version, confidence: 95, source: 'package.json / config' };
    },
  },
  {
    name: 'Prettier',
    category: 'linting',
    confidence: 95,
    source: 'prettier dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['prettier']) ||
        hasFile(ctx.filePaths, [
          '.prettierrc',
          '.prettierrc.json',
          '.prettierrc.js',
          'prettier.config.js',
        ]);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['prettier']);
      return { name: 'Prettier', version, confidence: 95, source: 'package.json / config' };
    },
  },
  {
    name: 'Husky',
    category: 'linting',
    confidence: 90,
    source: '.husky directory',
    detect: (ctx) => {
      if (!ctx.filePaths.some((f) => f.startsWith('.husky/'))) return null;
      return { name: 'Husky', confidence: 90, source: '.husky directory' };
    },
  },
  {
    name: 'Commitlint',
    category: 'linting',
    confidence: 90,
    source: 'commitlint dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['@commitlint/cli', '@commitlint/config-conventional']) ||
        hasFile(ctx.filePaths, [
          'commitlint.config.js',
          'commitlint.config.ts',
          '.commitlintrc.json',
        ]);
      if (!has) return null;
      return { name: 'Commitlint', confidence: 90, source: 'package.json / config' };
    },
  },
  {
    name: 'Biome',
    category: 'linting',
    confidence: 95,
    source: 'biome.json',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['biome.json', 'biome.jsonc'])) return null;
      return { name: 'Biome', confidence: 95, source: 'biome.json' };
    },
  },

  // AI
  {
    name: 'OpenAI',
    category: 'ai',
    confidence: 95,
    source: 'openai dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['openai'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['openai']);
      return { name: 'OpenAI', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Google Gemini',
    category: 'ai',
    confidence: 95,
    source: '@google/generative-ai dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@google/generative-ai'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@google/generative-ai']);
      return { name: 'Google Gemini', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Anthropic',
    category: 'ai',
    confidence: 95,
    source: '@anthropic-ai/sdk dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@anthropic-ai/sdk'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@anthropic-ai/sdk']);
      return { name: 'Anthropic', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Ollama',
    category: 'ai',
    confidence: 90,
    source: 'ollama dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['ollama'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['ollama']);
      return { name: 'Ollama', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Vercel AI SDK',
    category: 'ai',
    confidence: 95,
    source: 'ai / @ai-sdk dependency',
    detect: (ctx) => {
      const deps = [
        'ai',
        '@ai-sdk/openai',
        '@ai-sdk/anthropic',
        '@ai-sdk/google',
        '@ai-sdk/mistral',
      ];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, deps);
      return { name: 'Vercel AI SDK', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'LangChain',
    category: 'ai',
    confidence: 95,
    source: 'langchain dependency',
    detect: (ctx) => {
      const deps = ['langchain', '@langchain/core', '@langchain/openai', '@langchain/community'];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, ['langchain', '@langchain/core']);
      return { name: 'LangChain', version, confidence: 95, source: 'package.json' };
    },
  },

  // Authentication
  {
    name: 'JWT',
    category: 'authentication',
    confidence: 90,
    source: 'jsonwebtoken / jose dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['jsonwebtoken', 'jose'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['jsonwebtoken', 'jose']);
      return { name: 'JWT', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Clerk',
    category: 'authentication',
    confidence: 95,
    source: '@clerk/nextjs / @clerk/clerk-react dependency',
    detect: (ctx) => {
      const deps = ['@clerk/nextjs', '@clerk/clerk-react', '@clerk/backend'];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      const version = getDepVersion(ctx.packageJsons, deps);
      return { name: 'Clerk', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'NextAuth.js',
    category: 'authentication',
    confidence: 95,
    source: '@auth/core / next-auth dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['next-auth', '@auth/core', '@auth/nextjs'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['next-auth', '@auth/core']);
      return { name: 'NextAuth.js', version, confidence: 95, source: 'package.json' };
    },
  },
  {
    name: 'Supabase Auth',
    category: 'authentication',
    confidence: 90,
    source: '@supabase/auth-helpers dependency',
    detect: (ctx) => {
      const deps = [
        '@supabase/auth-helpers-nextjs',
        '@supabase/auth-helpers-react',
        '@supabase/ssr',
      ];
      if (!hasDep(ctx.packageJsons, deps)) return null;
      return { name: 'Supabase Auth', confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Firebase Auth',
    category: 'authentication',
    confidence: 90,
    source: 'firebase/auth dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['firebase'])) return null;
      for (const pj of ctx.packageJsons) {
        const deps: Record<string, string> = {
          ...((pj.data.dependencies as Record<string, string>) || {}),
          ...((pj.data.devDependencies as Record<string, string>) || {}),
        };
        if ('firebase' in deps)
          return { name: 'Firebase Auth', confidence: 90, source: 'package.json' };
      }
      return null;
    },
  },
  {
    name: 'Lucia',
    category: 'authentication',
    confidence: 90,
    source: 'lucia dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['lucia', 'lucia-auth'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['lucia', 'lucia-auth']);
      return { name: 'Lucia', version, confidence: 90, source: 'package.json' };
    },
  },

  // Deployment
  {
    name: 'Docker',
    category: 'deployment',
    confidence: 95,
    source: 'Dockerfile / docker-compose',
    detect: (ctx) => {
      const has = hasFile(ctx.filePaths, [
        'Dockerfile',
        'dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml',
        'docker-compose.json',
      ]);
      if (!has) return null;
      return { name: 'Docker', confidence: 95, source: 'Dockerfile / docker-compose' };
    },
  },
  {
    name: 'GitHub Actions',
    category: 'deployment',
    confidence: 95,
    source: '.github/workflows',
    detect: (ctx) => {
      const has = ctx.filePaths.some(
        (f) => f.startsWith('.github/workflows/') && (f.endsWith('.yml') || f.endsWith('.yaml')),
      );
      if (!has) return null;
      return { name: 'GitHub Actions', confidence: 95, source: '.github/workflows' };
    },
  },
  {
    name: 'Vercel',
    category: 'deployment',
    confidence: 90,
    source: 'vercel.json / .vercelignore',
    detect: (ctx) => {
      const has = hasFile(ctx.filePaths, ['vercel.json', '.vercelignore', 'now.json']);
      if (!has) return null;
      return { name: 'Vercel', confidence: 90, source: 'config file' };
    },
  },
  {
    name: 'Netlify',
    category: 'deployment',
    confidence: 90,
    source: 'netlify.toml / _redirects',
    detect: (ctx) => {
      const has = hasFile(ctx.filePaths, ['netlify.toml', '_redirects', 'netlify.json']);
      if (!has) return null;
      return { name: 'Netlify', confidence: 90, source: 'config file' };
    },
  },
  {
    name: 'AWS',
    category: 'deployment',
    confidence: 85,
    source: 'AWS config / CDK / SAM',
    detect: (ctx) => {
      const has =
        hasFile(ctx.filePaths, ['samconfig.toml', 'aws-exports.json', 'stack.js', 'cdk.json']) ||
        hasDep(ctx.packageJsons, ['aws-cdk-lib', '@aws-sdk/client-s3']);
      if (!has) return null;
      return { name: 'AWS', confidence: 85, source: 'config / dependency' };
    },
  },
  {
    name: 'Railway',
    category: 'deployment',
    confidence: 85,
    source: 'railway.json / Procfile',
    detect: (ctx) => {
      const has = hasFile(ctx.filePaths, ['railway.json', 'railway.toml', 'Procfile']);
      if (!has) return null;
      return { name: 'Railway', confidence: 85, source: 'config file' };
    },
  },
  {
    name: 'Render',
    category: 'deployment',
    confidence: 85,
    source: 'render.yaml',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['render.yaml'])) return null;
      return { name: 'Render', confidence: 85, source: 'render.yaml' };
    },
  },

  // Package Manager
  {
    name: 'pnpm',
    category: 'packageManager',
    confidence: 100,
    source: 'pnpm-lock.yaml',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['pnpm-lock.yaml'])) return null;
      return { name: 'pnpm', confidence: 100, source: 'pnpm-lock.yaml' };
    },
  },
  {
    name: 'Yarn',
    category: 'packageManager',
    confidence: 100,
    source: 'yarn.lock',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['yarn.lock'])) return null;
      return { name: 'Yarn', confidence: 100, source: 'yarn.lock' };
    },
  },
  {
    name: 'Bun',
    category: 'packageManager',
    confidence: 100,
    source: 'bun.lockb',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['bun.lockb'])) return null;
      return { name: 'Bun', confidence: 100, source: 'bun.lockb' };
    },
  },
  {
    name: 'npm',
    category: 'packageManager',
    confidence: 100,
    source: 'package-lock.json',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['package-lock.json'])) return null;
      return { name: 'npm', confidence: 100, source: 'package-lock.json' };
    },
  },

  // Build Tool
  {
    name: 'Vite',
    category: 'buildTool',
    confidence: 95,
    source: 'vite dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['vite']) ||
        hasFile(ctx.filePaths, [
          'vite.config.js',
          'vite.config.ts',
          'vite.config.mjs',
          'vite.config.cjs',
        ]);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['vite']);
      return { name: 'Vite', version, confidence: 95, source: 'package.json / config' };
    },
  },
  {
    name: 'Webpack',
    category: 'buildTool',
    confidence: 95,
    source: 'webpack dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['webpack', 'webpack-cli', 'webpack-dev-server']) ||
        hasFile(ctx.filePaths, ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs']);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['webpack']);
      return { name: 'Webpack', version, confidence: 95, source: 'package.json / config' };
    },
  },
  {
    name: 'Turbopack',
    category: 'buildTool',
    confidence: 90,
    source: 'next.config turbopack flag',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['next'])) return null;
      for (const content of ctx.fileContents.values()) {
        if (content.includes('turbopack'))
          return { name: 'Turbopack', confidence: 90, source: 'next.config' };
      }
      return null;
    },
  },
  {
    name: 'esbuild',
    category: 'buildTool',
    confidence: 90,
    source: 'esbuild dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['esbuild'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['esbuild']);
      return { name: 'esbuild', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Rollup',
    category: 'buildTool',
    confidence: 90,
    source: 'rollup dependency / config',
    detect: (ctx) => {
      const has =
        hasDep(ctx.packageJsons, ['rollup']) ||
        hasFile(ctx.filePaths, ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs']);
      if (!has) return null;
      const version = getDepVersion(ctx.packageJsons, ['rollup']);
      return { name: 'Rollup', version, confidence: 90, source: 'package.json / config' };
    },
  },
  {
    name: 'SWC',
    category: 'buildTool',
    confidence: 90,
    source: '@swc/core dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['@swc/core', '@swc/cli'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['@swc/core']);
      return { name: 'SWC', version, confidence: 90, source: 'package.json' };
    },
  },
  {
    name: 'Turborepo',
    category: 'buildTool',
    confidence: 95,
    source: 'turbo dependency',
    detect: (ctx) => {
      if (!hasDep(ctx.packageJsons, ['turbo'])) return null;
      const version = getDepVersion(ctx.packageJsons, ['turbo']);
      return { name: 'Turborepo', version, confidence: 95, source: 'package.json' };
    },
  },

  // Runtime
  {
    name: 'Node.js',
    category: 'runtime',
    confidence: 90,
    source: '.nvmrc / package.json engines',
    detect: (ctx) => {
      if (hasFile(ctx.filePaths, ['.nvmrc', '.node-version', '.tool-versions'])) {
        for (const [path, content] of ctx.fileContents.entries()) {
          if (path.endsWith('.nvmrc') || path.endsWith('.node-version')) {
            return {
              name: 'Node.js',
              version: content.trim().replace(/^v/, ''),
              confidence: 90,
              source: path,
            };
          }
        }
        return { name: 'Node.js', confidence: 90, source: 'config file' };
      }
      for (const pj of ctx.packageJsons) {
        const engines = pj.data.engines as Record<string, string> | undefined;
        if (engines?.node) {
          return {
            name: 'Node.js',
            version: stripVersionPrefix(engines.node),
            confidence: 90,
            source: pj.path,
          };
        }
      }
      return null;
    },
  },
  {
    name: 'Deno',
    category: 'runtime',
    confidence: 100,
    source: 'deno.json',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['deno.json', 'deno.jsonc'])) return null;
      return { name: 'Deno', confidence: 100, source: 'deno.json' };
    },
  },
  {
    name: 'Bun Runtime',
    category: 'runtime',
    confidence: 95,
    source: 'bun.lockb',
    detect: (ctx) => {
      if (!hasFile(ctx.filePaths, ['bun.lockb'])) return null;
      return { name: 'Bun', confidence: 95, source: 'bun.lockb' };
    },
  },
];

export class RepositoryAnalyzer {
  async analyze(userId: string, owner: string, repo: string): Promise<TechnologyStack> {
    const octokit = await getOctokit(userId);

    const treeData = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true',
    });

    const allFiles = (
      treeData.data.tree as Array<{ path: string; type: string; size?: number }>
    ).filter((item) => item.type === 'blob');

    const relevantFiles = allFiles
      .filter((item) => isRelevantFile(item.path))
      .map((item) => item.path);

    const filesToFetch = relevantFiles.slice(0, 50);

    const fetched = await Promise.allSettled(
      filesToFetch.map(async (path) => {
        try {
          const content = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
          });
          if ('content' in content.data && typeof content.data.content === 'string') {
            return { path, content: Buffer.from(content.data.content, 'base64').toString('utf-8') };
          }
          return { path, content: '' };
        } catch {
          return { path, content: '' };
        }
      }),
    );

    const fileContents = new Map<string, string>();
    for (const result of fetched) {
      if (result.status === 'fulfilled' && result.value.content) {
        fileContents.set(result.value.path, result.value.content);
      }
    }

    const packageJsons: Array<{ path: string; data: Record<string, unknown> }> = [];
    for (const [path, content] of fileContents.entries()) {
      if (path.endsWith('package.json')) {
        const data = parseJsonSafe(content);
        if (data) packageJsons.push({ path, data });
      }
    }

    const ctx: DetectionContext = {
      filePaths: relevantFiles,
      fileContents,
      packageJsons,
    };

    const stack: TechnologyStack = {
      architecture: [],
      frontend: [],
      backend: [],
      database: [],
      orm: [],
      styling: [],
      testing: [],
      linting: [],
      ai: [],
      authentication: [],
      deployment: [],
      packageManager: [],
      buildTool: [],
      runtime: [],
    };

    for (const rule of rules) {
      const result = rule.detect(ctx);
      if (result) {
        stack[rule.category].push({
          name: result.name,
          version: result.version,
          confidence: result.confidence || rule.confidence,
          source: result.source || rule.source,
        });
      }
    }

    const categories = Object.keys(stack) as Array<keyof TechnologyStack>;
    for (const cat of categories) {
      stack[cat].sort((a, b) => b.confidence - a.confidence);
    }

    return stack;
  }
}

export const repositoryAnalyzer = new RepositoryAnalyzer();
