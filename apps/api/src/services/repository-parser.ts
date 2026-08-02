import type { RepoFileNode, RepoFileMetadata } from '../types/repository';

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
  '.gitignore',
]);

const SUPPORTED_CONFIG_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mts',
  'tailwind.config.ts',
  'tailwind.config.js',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'nuxt.config.ts',
  'nuxt.config.js',
  'webpack.config.js',
  'webpack.config.ts',
  'rollup.config.js',
  'rollup.config.ts',
  'esbuild.config.js',
  'esbuild.config.ts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Makefile',
  '.env',
  '.env.example',
  '.env.local',
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.git',
  'public',
  'assets',
  '__tests__',
  '__mocks__',
  '.turbo',
  '.cache',
  '.vercel',
  '.netlify',
  'vendor',
  '.gradle',
  'target',
]);

const MAX_TREE_DEPTH = 6;

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.html': 'HTML',
  '.env': 'ENV',
  '.gitignore': 'Git',
};

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(dotIndex) : '';
}

function getLanguage(filename: string): string {
  const ext = getExtension(filename);
  return EXTENSION_TO_LANGUAGE[ext] || 'Other';
}

function isSupportedFile(filename: string): boolean {
  const ext = getExtension(filename);
  if (SUPPORTED_EXTENSIONS.has(ext)) return true;
  if (SUPPORTED_CONFIG_FILES.has(filename)) return true;
  return false;
}

function shouldIgnoreDir(name: string): boolean {
  if (IGNORED_DIRS.has(name)) return true;
  if (name.startsWith('.')) return true;
  return false;
}

export function buildRepoTree(
  items: Array<{ path: string; type: string; sha?: string; size?: number }>,
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
    if (item.type === 'tree' && shouldIgnoreDir(name)) continue;

    const node: RepoFileNode = {
      path: item.path,
      name,
      type: item.type === 'tree' ? 'dir' : 'file',
      sha: item.sha,
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

export function filterSupportedFiles(
  items: Array<{ path: string; type: string; sha?: string; size?: number }>,
): Array<{ path: string; type: string; sha?: string; size?: number }> {
  return items.filter((item) => {
    if (item.type === 'tree') {
      const name = item.path.split('/').pop() || '';
      return !shouldIgnoreDir(name);
    }
    const filename = item.path.split('/').pop() || '';
    return isSupportedFile(filename);
  });
}

export function parseFileMetadata(
  item: { path: string; sha?: string; size?: number },
  content?: string,
): RepoFileMetadata {
  const filename = item.path.split('/').pop() || '';
  const imports: string[] = [];
  const exports: string[] = [];

  if (content) {
    const importRegex = /^import\s+(?:.*from\s+)?['"]([^'"]+)['"]/gm;
    const exportRegex =
      /^export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1] && !match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
  }

  return {
    path: item.path,
    name: filename,
    extension: getExtension(filename),
    language: getLanguage(filename),
    size: item.size || 0,
    sha: item.sha || '',
    imports,
    exports,
    lineCount: content ? content.split('\n').length : undefined,
  };
}

export function buildTreeSummary(tree: RepoFileNode[], prefix: string = ''): string {
  let summary = '';
  for (const node of tree) {
    const connector = node === tree[tree.length - 1] ? '└── ' : '├── ';
    const icon = node.type === 'dir' ? '📁 ' : '📄 ';
    summary += `${prefix}${connector}${icon}${node.name}\n`;
    if (node.type === 'dir' && node.children) {
      const newPrefix = prefix + (node === tree[tree.length - 1] ? '    ' : '│   ');
      summary += buildTreeSummary(node.children, newPrefix);
    }
  }
  return summary;
}

export function flattenTree(tree: RepoFileNode[]): RepoFileNode[] {
  const result: RepoFileNode[] = [];
  function walk(nodes: RepoFileNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children) walk(node.children);
    }
  }
  walk(tree);
  return result;
}

export function findFilesByKeywords(tree: RepoFileNode[], keywords: string[]): string[] {
  const results: string[] = [];
  const allFiles = flattenTree(tree).filter((n) => n.type === 'file');

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase();
    for (const file of allFiles) {
      if (file.name.toLowerCase().includes(lower) || file.path.toLowerCase().includes(lower)) {
        if (!results.includes(file.path)) {
          results.push(file.path);
        }
      }
    }
  }

  return results;
}
