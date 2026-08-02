import type {
  RepoFileNode,
  RepoFileMetadata,
  RepoLanguageBreakdown,
  RepoStats,
} from '../types/repository';

const COMPONENT_PATTERNS = [
  /^(?:export\s+)?(?:default\s+)?(?:function|class)\s+[A-Z]\w*/m,
  /React\.FC/,
  /React\.memo\(/,
  /forwardRef\(/,
  /createContext\(/,
];

const HOOK_PATTERNS = [/^export\s+(?:function|const)\s+use[A-Z]\w*/m, /^const\s+use[A-Z]\w*\s*=/m];

const API_ROUTE_PATTERNS = [
  /router\.(get|post|put|patch|delete)\(/,
  /app\.(get|post|put|patch|delete)\(/,
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/,
  /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)/,
  /@(Get|Post|Put|Patch|Delete)Mapper/,
];

export function analyzeLanguageBreakdown(fileMetadata: RepoFileMetadata[]): RepoLanguageBreakdown {
  const breakdown: RepoLanguageBreakdown = {};

  for (const file of fileMetadata) {
    const lang = file.language;
    if (!breakdown[lang]) {
      breakdown[lang] = { files: 0, totalSize: 0 };
    }
    breakdown[lang].files++;
    breakdown[lang].totalSize += file.size;
  }

  return breakdown;
}

export function analyzeStats(
  tree: RepoFileNode[],
  _fileMetadata: RepoFileMetadata[],
  fileContents: Map<string, string>,
): RepoStats {
  const allFiles = flattenTree(tree).filter((n) => n.type === 'file');
  const allDirs = flattenTree(tree).filter((n) => n.type === 'dir');

  let componentCount = 0;
  let hookCount = 0;
  let apiRouteCount = 0;
  const configFiles: string[] = [];
  const keyFiles: string[] = [];
  let totalSize = 0;

  for (const file of allFiles) {
    totalSize += file.size || 0;

    const filename = file.name;
    if (
      filename === 'package.json' ||
      filename === 'tsconfig.json' ||
      filename.endsWith('.config.ts') ||
      filename.endsWith('.config.js')
    ) {
      configFiles.push(file.path);
    }
    if (filename === 'README.md' || filename === 'CONTRIBUTING.md' || filename === 'LICENSE') {
      keyFiles.push(file.path);
    }

    const content = fileContents.get(file.path);
    if (content) {
      for (const pattern of COMPONENT_PATTERNS) {
        if (pattern.test(content)) {
          componentCount++;
          break;
        }
      }

      for (const pattern of HOOK_PATTERNS) {
        if (pattern.test(content)) {
          hookCount++;
          break;
        }
      }

      for (const pattern of API_ROUTE_PATTERNS) {
        if (pattern.test(content)) {
          apiRouteCount++;
          break;
        }
      }
    }
  }

  return {
    totalFiles: allFiles.length,
    totalDirectories: allDirs.length,
    totalSize,
    componentCount,
    apiRouteCount,
    hookCount,
    configFiles,
    keyFiles,
  };
}

function flattenTree(tree: RepoFileNode[]): RepoFileNode[] {
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
