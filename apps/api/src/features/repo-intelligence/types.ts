export type ProjectType =
  'web-app' | 'api' | 'library' | 'cli' | 'mobile' | 'monorepo' | 'static-site' | 'unknown';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'css'
  | 'html'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'shell'
  | 'other';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

export type BuildTool =
  'vite' | 'webpack' | 'rollup' | 'esbuild' | 'turbo' | 'nx' | 'tsc' | 'swc' | 'parcel' | 'unknown';

export type TestingFramework =
  'jest' | 'vitest' | 'mocha' | 'cypress' | 'playwright' | 'testing-library' | 'ava' | 'unknown';

export type LintingTool = 'eslint' | 'biome' | 'oxlint' | 'unknown';

export type FormattingTool = 'prettier' | 'biome' | 'dprint' | 'unknown';

export type Framework =
  | 'react'
  | 'next'
  | 'vue'
  | 'nuxt'
  | 'angular'
  | 'svelte'
  | 'sveltekit'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'koa'
  | 'hono'
  | 'remix'
  | 'astro'
  | 'unknown';

export type Database =
  'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase' | 'firebase' | 'unknown';

export type ORM = 'prisma' | 'drizzle' | 'mongoose' | 'typeorm' | 'sequelize' | 'knex' | 'unknown';

export type StylingTool =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'emotion'
  | 'sass'
  | 'bootstrap'
  | 'material-ui'
  | 'chakra-ui'
  | 'shadcn'
  | 'unknown';

export type StateManagement =
  'redux' | 'zustand' | 'jotai' | 'recoil' | 'mobx' | 'pinia' | 'vuex' | 'context-api' | 'unknown';

export interface DetectedTechnology {
  name: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface ImportantFile {
  path: string;
  purpose: string;
  exists: boolean;
}

export interface FolderNode {
  name: string;
  type: 'file' | 'directory';
  children?: FolderNode[];
}

export interface RepositoryIntelligence {
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  projectType: ProjectType;
  detectedLanguages: DetectedTechnology[];
  detectedFrameworks: DetectedTechnology[];
  detectedDatabases: DetectedTechnology[];
  detectedORMs: DetectedTechnology[];
  detectedTesting: DetectedTechnology[];
  detectedStyling: DetectedTechnology[];
  detectedStateManagement: DetectedTechnology[];
  packageManager: PackageManager;
  buildTools: DetectedTechnology[];
  lintingTools: DetectedTechnology[];
  formattingTools: DetectedTechnology[];
  importantFiles: ImportantFile[];
  folderTreeSummary: FolderNode[];
  repositorySummary: string;
  generatedAt: string;
}

export interface IntelligenceRequest {
  owner: string;
  repo: string;
  branch?: string;
}

export interface IntelligenceResponse {
  success: boolean;
  data?: RepositoryIntelligence;
  error?: { message: string };
}
