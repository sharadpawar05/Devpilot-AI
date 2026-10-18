import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import type { HealthActionType } from './types';

export interface GenerationResult {
  fileName: string;
  filePath: string;
  content: string;
  language: string;
  explanation: {
    whatItAdds: string[];
    estimatedExecutionTime: string;
    compatibility: string[];
  };
}

interface RepoContext {
  packageJson: Record<string, unknown> | null;
  readme: string;
  languages: Record<string, number>;
  treePaths: string[];
  primaryLanguage: string | null;
}

async function gatherContext(userId: string, owner: string, repo: string): Promise<RepoContext> {
  const [readme, languages, treePaths] = await Promise.all([
    repositoryIntelligenceService.getReadme(userId, owner, repo),
    repositoryIntelligenceService.getLanguages(userId, owner, repo),
    repositoryIntelligenceService.getFlatFilePaths(userId, owner, repo),
  ]);

  let packageJson: Record<string, unknown> | null = null;
  const packageContent = await repositoryIntelligenceService.getFileContent(
    userId,
    owner,
    repo,
    'package.json',
  );
  if (packageContent) {
    try {
      packageJson = JSON.parse(packageContent.content) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }
  }

  const primaryLanguage = Object.entries(languages).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  return { packageJson, readme, languages, treePaths, primaryLanguage };
}

function detectFramework(ctx: RepoContext): string {
  const deps = ctx.packageJson
    ? {
        ...((ctx.packageJson.dependencies as Record<string, string>) || {}),
        ...((ctx.packageJson.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['next']) return 'Next.js';
  if (deps['nuxt']) return 'Nuxt';
  if (deps['@angular/core']) return 'Angular';
  if (deps['vue'] || deps['@vue/cli-service']) return 'Vue';
  if (deps['svelte'] || deps['@sveltejs/kit']) return 'Svelte';
  if (deps['react'] && deps['vite']) return 'React + Vite';
  if (deps['react']) return 'React';
  if (deps['express']) return 'Express';
  if (deps['fastify']) return 'Fastify';
  if (deps['nestjs'] || deps['@nestjs/core']) return 'NestJS';
  if (deps['django']) return 'Django';
  if (deps['flask']) return 'Flask';
  if (deps['rails']) return 'Rails';
  if (ctx.primaryLanguage === 'Go') return 'Go';
  if (ctx.primaryLanguage === 'Rust') return 'Rust';
  if (ctx.primaryLanguage === 'Python') return 'Python';
  return 'Unknown';
}

function detectPackageManager(ctx: RepoContext): string {
  if (ctx.treePaths.some((p) => p === 'pnpm-lock.yaml')) return 'pnpm';
  if (ctx.treePaths.some((p) => p === 'yarn.lock')) return 'yarn';
  if (ctx.treePaths.some((p) => p === 'bun.lockb')) return 'bun';
  return 'npm';
}

function detectTestFramework(ctx: RepoContext): string {
  const deps = ctx.packageJson
    ? {
        ...((ctx.packageJson.dependencies as Record<string, string>) || {}),
        ...((ctx.packageJson.devDependencies as Record<string, string>) || {}),
      }
    : {};

  if (deps['vitest'] || deps['@vitest/coverage-v8']) return 'Vitest';
  if (deps['jest'] || deps['@jest/globals']) return 'Jest';
  if (deps['@playwright/test']) return 'Playwright';
  if (deps['cypress']) return 'Cypress';
  return 'none';
}

function detectScripts(ctx: RepoContext): Record<string, string> {
  return ((ctx.packageJson?.scripts as Record<string, string>) || {}) as Record<string, string>;
}

const GENERATOR_PROMPTS: Record<
  HealthActionType,
  {
    systemPrompt: string;
    userPromptTemplate: (ctx: RepoContext, framework: string, pm: string) => string;
    fileName: string;
    filePath: string;
    language: string;
  }
> = {
  'generate-license': {
    systemPrompt:
      'You are a legal document generator. Generate a standard open-source license. Output ONLY the license text, no markdown, no code fences, no explanation.',
    userPromptTemplate: () =>
      `Generate an MIT License file. Use the current year (${new Date().getFullYear()}) and "the project authors" as the copyright holder. Output only the raw license text.`,
    fileName: 'LICENSE',
    filePath: 'LICENSE',
    language: 'text',
  },
  'generate-gitignore': {
    systemPrompt:
      'You are a DevOps expert. Generate a comprehensive .gitignore file. Output ONLY the file content, no markdown, no code fences.',
    userPromptTemplate: (ctx) => {
      const lang = ctx.primaryLanguage || 'Unknown';
      const framework = detectFramework(ctx);
      return `Generate a .gitignore for a ${framework} project using ${lang}. Include entries for: node_modules, dist, build, coverage, .env, .DS_Store, IDE files, and framework-specific exclusions. Output only the raw .gitignore content.`;
    },
    fileName: '.gitignore',
    filePath: '.gitignore',
    language: 'text',
  },
  'generate-readme': {
    systemPrompt:
      'You are a technical documentation expert. Generate a professional README.md. Output ONLY the markdown content, no code fences around the whole thing.',
    userPromptTemplate: (ctx, framework, pm) => {
      const scripts = detectScripts(ctx);
      const scriptList = Object.keys(scripts)
        .map((k) => `- \`${pm} run ${k}\``)
        .join('\n');
      const deps = ctx.packageJson
        ? Object.keys((ctx.packageJson.dependencies as Record<string, string>) || {}).slice(0, 15)
        : [];
      return `Generate a professional README.md for a ${framework} project.

Description from package.json: ${(ctx.packageJson?.description as string) || 'No description'}
Languages: ${Object.keys(ctx.languages).join(', ')}
Package manager: ${pm}
Available scripts:\n${scriptList || 'None detected'}
Key dependencies: ${deps.join(', ') || 'None detected'}

Include sections: Overview, Installation, Usage, Available Scripts, Folder Structure, Contributing, License.`;
    },
    fileName: 'README.md',
    filePath: 'README.md',
    language: 'markdown',
  },
  'generate-ci': {
    systemPrompt:
      'You are a CI/CD expert. Generate a GitHub Actions workflow file. Output ONLY the YAML content in a code fence with language tag "yaml".',
    userPromptTemplate: (ctx, framework, pm) => {
      const scripts = detectScripts(ctx);
      const hasLint = !!scripts['lint'] || !!scripts['eslint'];
      const hasTest = !!scripts['test'];
      const hasBuild = !!scripts['build'];
      return `Generate a GitHub Actions CI workflow for a ${framework} project using ${pm}.

Available scripts: ${Object.keys(scripts).join(', ') || 'none detected'}
Has lint script: ${hasLint}
Has test script: ${hasTest}
Has build script: ${hasBuild}

Requirements:
- Trigger on push to main and pull requests
- Install dependencies using ${pm}
${hasLint ? '- Run linting' : ''}
${hasTest ? '- Run tests' : ''}
${hasBuild ? '- Run build' : ''}
- Use Node.js 20

Output the YAML inside a code fence with language tag "yaml".`;
    },
    fileName: 'ci.yml',
    filePath: '.github/workflows/ci.yml',
    language: 'yaml',
  },
  'generate-tests': {
    systemPrompt:
      'You are a testing expert. Generate a test setup configuration and sample tests. Output the content in appropriate code fences.',
    userPromptTemplate: (ctx, framework) => {
      const testFramework = detectTestFramework(ctx);
      return `Generate a test setup for a ${framework} project.

Current test framework: ${testFramework}
${testFramework === 'none' ? 'No test framework is installed. Generate a Vitest configuration and sample test.' : `The project uses ${testFramework}. Generate sample tests.`}

Generate:
1. A test configuration file (vitest.config.ts or jest.config.ts)
2. A sample test file with 2-3 meaningful test cases

Output both files separated by a clear marker: "---FILE: filename---"`;
    },
    fileName: 'vitest.config.ts',
    filePath: 'vitest.config.ts',
    language: 'typescript',
  },
  'generate-dockerfile': {
    systemPrompt:
      'You are a Docker expert. Generate an optimized Dockerfile. Output ONLY the Dockerfile content, no markdown.',
    userPromptTemplate: (_ctx, framework, pm) => {
      const nodeVersion = '20';
      return `Generate an optimized multi-stage Dockerfile for a ${framework} project using ${pm}.

Requirements:
- Use node:${nodeVersion}-alpine as base
- Multi-stage build (deps → build → production)
- Install dependencies first for layer caching
- Copy only production artifacts
- Use non-root user
- Expose port 3000

Output only the raw Dockerfile content.`;
    },
    fileName: 'Dockerfile',
    filePath: 'Dockerfile',
    language: 'dockerfile',
  },
  'generate-env-example': {
    systemPrompt:
      'You are a configuration expert. Generate a .env.example file based on the repository context. Output ONLY the file content.',
    userPromptTemplate: (ctx) => {
      const readme = ctx.readme.slice(0, 3000);
      return `Analyze this repository and generate a .env.example file with placeholder values.

README excerpt:\n${readme || 'No README available'}

Look for:
- API keys or tokens referenced
- Database connection strings
- Port configurations
- Feature flags
- Third-party service URLs

If no environment variables are apparent, generate a template with common placeholders (DATABASE_URL, API_KEY, NODE_ENV, PORT).

Output only the raw .env.example content.`;
    },
    fileName: '.env.example',
    filePath: '.env.example',
    language: 'text',
  },
  'generate-package-json': {
    systemPrompt:
      'You are a Node.js project expert. Generate a package.json file. Output ONLY the JSON content, no markdown, no code fences.',
    userPromptTemplate: (ctx, framework, pm) => {
      const scripts = detectScripts(ctx);
      return `Generate a package.json for a ${framework} project using ${pm}.

Current scripts: ${Object.keys(scripts).join(', ') || 'none detected'}

Requirements:
- Set name to the repository name
- Include appropriate scripts for the framework
- Use modern ESM configuration
- Include placeholder version 1.0.0

Output only the raw JSON content.`;
    },
    fileName: 'package.json',
    filePath: 'package.json',
    language: 'json',
  },
  'generate-docs': {
    systemPrompt:
      'You are a technical documentation expert. Generate comprehensive documentation. Output ONLY the markdown content.',
    userPromptTemplate: (ctx, framework, pm) => {
      const scripts = detectScripts(ctx);
      return `Generate comprehensive documentation for a ${framework} project using ${pm}.

Available scripts: ${Object.keys(scripts).join(', ') || 'none detected'}
Languages: ${Object.keys(ctx.languages).join(', ')}

Generate documentation including:
1. Getting Started guide
2. API reference
3. Configuration options
4. Contributing guidelines

Output only the raw markdown content.`;
    },
    fileName: 'docs.md',
    filePath: 'docs.md',
    language: 'markdown',
  },
  'improve-coverage': {
    systemPrompt:
      'You are a testing expert. Suggest improvements for test coverage. Output ONLY the markdown content.',
    userPromptTemplate: (_ctx, framework) =>
      `Analyze this ${framework} project and provide actionable recommendations to improve test coverage. Include specific test file examples and patterns to follow.

Output only the raw markdown content.`,
    fileName: 'TESTING.md',
    filePath: 'TESTING.md',
    language: 'markdown',
  },
  'improve-readme': {
    systemPrompt:
      'You are a technical documentation expert. Improve the existing README. Output ONLY the markdown content.',
    userPromptTemplate: (ctx, framework, pm) => {
      const readme = ctx.readme.slice(0, 5000);
      return `Improve this README.md for a ${framework} project using ${pm}.

Current README:\n${readme || 'No README available'}

Enhance it with better structure, examples, and clarity. Output only the raw markdown content.`;
    },
    fileName: 'README.md',
    filePath: 'README.md',
    language: 'markdown',
  },
  'add-ci-pipeline': {
    systemPrompt:
      'You are a CI/CD expert. Generate GitHub Actions workflow files. Output ONLY the YAML content.',
    userPromptTemplate: (_ctx, framework, pm) =>
      `Generate a GitHub Actions CI/CD workflow for a ${framework} project using ${pm}.

Include: lint, test, and build steps. Output only the raw YAML content.`,
    fileName: 'ci.yml',
    filePath: '.github/workflows/ci.yml',
    language: 'yaml',
  },
  'fix-vulnerabilities': {
    systemPrompt:
      'You are a security expert. Provide recommendations to fix security vulnerabilities. Output ONLY the markdown content.',
    userPromptTemplate: (_ctx, framework) =>
      `Provide a security hardening guide for a ${framework} project. Include dependency updates, security headers, and best practices. Output only the raw markdown content.`,
    fileName: 'SECURITY.md',
    filePath: 'SECURITY.md',
    language: 'markdown',
  },
  'update-dependencies': {
    systemPrompt:
      'You are a dependency management expert. Provide recommendations for updating dependencies. Output ONLY the markdown content.',
    userPromptTemplate: (ctx, framework, pm) => {
      const deps = ctx.packageJson
        ? Object.keys((ctx.packageJson.dependencies as Record<string, string>) || {}).slice(0, 20)
        : [];
      return `Provide a dependency update guide for a ${framework} project using ${pm}.

Current dependencies: ${deps.join(', ') || 'none detected'}

Include update strategy, breaking change considerations, and testing recommendations. Output only the raw markdown content.`;
    },
    fileName: 'DEPENDENCIES.md',
    filePath: 'DEPENDENCIES.md',
    language: 'markdown',
  },
  none: {
    systemPrompt: '',
    userPromptTemplate: () => '',
    fileName: '',
    filePath: '',
    language: 'text',
  },
};

function buildExplanation(
  actionType: HealthActionType,
  framework: string,
  pm: string,
): GenerationResult['explanation'] {
  const explanations: Record<string, GenerationResult['explanation']> = {
    'generate-license': {
      whatItAdds: [
        'Legal permissions for use, modification, and distribution',
        'Clear terms for contributors',
        'Protection for project authors',
      ],
      estimatedExecutionTime: 'Instant',
      compatibility: ['All projects'],
    },
    'generate-gitignore': {
      whatItAdds: [
        'Excludes build artifacts from version control',
        'Prevents secrets and dependencies from being committed',
        'Keeps the repository clean',
      ],
      estimatedExecutionTime: 'Instant',
      compatibility: [framework, pm],
    },
    'generate-readme': {
      whatItAdds: [
        'Project overview and purpose',
        'Installation and setup instructions',
        'Usage examples and API reference',
        'Contributing guidelines',
      ],
      estimatedExecutionTime: '1–2 minutes',
      compatibility: [framework, pm, 'GitHub'],
    },
    'generate-ci': {
      whatItAdds: [
        'Run on every Pull Request',
        'Run on Push to main',
        'Install dependencies',
        'Run ESLint',
        'Execute tests',
        'Build project',
      ],
      estimatedExecutionTime: '1–3 minutes',
      compatibility: [framework, pm, 'GitHub Actions'],
    },
    'generate-tests': {
      whatItAdds: [
        'Test framework configuration',
        'Sample unit test cases',
        'Test coverage setup',
        'npm test script integration',
      ],
      estimatedExecutionTime: '5–10 minutes',
      compatibility: [
        framework,
        detectTestFramework({
          packageJson: null,
          readme: '',
          languages: {},
          treePaths: [],
          primaryLanguage: null,
        }),
      ],
    },
    'generate-dockerfile': {
      whatItAdds: [
        'Multi-stage build for smaller images',
        'Layer caching for faster builds',
        'Non-root user for security',
        'Production-ready container',
      ],
      estimatedExecutionTime: '2–5 minutes',
      compatibility: [framework, pm, 'Docker'],
    },
    'generate-env-example': {
      whatItAdds: [
        'Documents required environment variables',
        'Provides placeholder values for setup',
        'Helps new contributors configure locally',
      ],
      estimatedExecutionTime: 'Instant',
      compatibility: [framework],
    },
  };

  return (
    explanations[actionType] || {
      whatItAdds: [],
      estimatedExecutionTime: 'Unknown',
      compatibility: [],
    }
  );
}

function cleanGeneratedContent(content: string, actionType: HealthActionType): string {
  let cleaned = content;
  // Remove markdown code fences if present
  const fenceMatch = cleaned.match(/^```(?:\w+)?\n([\s\S]*?)```$/m);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  // Remove leading conversational preamble text for non-CI generators.
  // Only preamble lines ("Here is...", "This is...") are stripped — a
  // heading-first markdown file must keep its heading.
  if (actionType !== 'generate-ci' && actionType !== 'generate-tests') {
    const lines = cleaned.split('\n');
    const startIdx = lines.findIndex(
      (l) => l.trim().length > 0 && !l.startsWith('Here') && !l.startsWith('This'),
    );
    if (startIdx > 0) cleaned = lines.slice(startIdx).join('\n');
  }
  return cleaned.trim();
}

export class GeneratorService {
  async generate(
    userId: string,
    owner: string,
    repo: string,
    actionType: HealthActionType,
  ): Promise<GenerationResult> {
    const config = GENERATOR_PROMPTS[actionType];
    if (!config || actionType === 'none') {
      throw new Error(`Unknown generator type: ${actionType}`);
    }

    const ctx = await gatherContext(userId, owner, repo);
    const framework = detectFramework(ctx);
    const pm = detectPackageManager(ctx);

    const userPrompt = config.userPromptTemplate(ctx, framework, pm);

    const response = await aiService.generate(userPrompt, config.systemPrompt, {
      provider: 'gemini',
      maxTokens: 4096,
    });

    const content = cleanGeneratedContent(response.content, actionType);
    const explanation = buildExplanation(actionType, framework, pm);

    // For test generation with multiple files, extract first file
    let finalContent = content;
    let finalFileName = config.fileName;
    let finalFilePath = config.filePath;

    if (actionType === 'generate-tests' && content.includes('---FILE:')) {
      const parts = content.split(/---FILE:\s*(\S+)\s*---/);
      if (parts.length >= 3) {
        finalFileName = parts[1];
        finalFilePath = parts[1];
        finalContent = parts[2].trim();
      }
    }

    // Reject invalid AI output instead of returning an empty artifact.
    // Throwing here routes through the endpoint's catch → quota refund.
    if (!finalContent.trim()) {
      throw new Error('The AI model returned empty content. Please try again.');
    }

    return {
      fileName: finalFileName,
      filePath: finalFilePath,
      content: finalContent,
      language: config.language,
      explanation,
    };
  }
}

export const generatorService = new GeneratorService();
