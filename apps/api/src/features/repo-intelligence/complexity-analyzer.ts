import type { LargeFileItem } from './types';

const LARGE_FILE_THRESHOLD_LINES = 500;
const VERY_LARGE_FILE_THRESHOLD_LINES = 1000;

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.cs',
  '.php',
  '.swift',
  '.cpp',
  '.c',
  '.h',
]);

function estimateLineCount(content: string): number {
  let lines = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  return lines + 1;
}

function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    mjs: 'JavaScript',
    cjs: 'JavaScript',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    cs: 'C#',
    php: 'PHP',
    swift: 'Swift',
    cpp: 'C++',
    c: 'C',
    h: 'C',
  };
  return ext ? map[ext] : undefined;
}

export interface ComplexityAnalysisResult {
  complexityScore: number;
  largeFiles: LargeFileItem[];
}

export function analyzeComplexity(
  filePaths: string[],
  fileContents: Map<string, string>,
): ComplexityAnalysisResult {
  const largeFiles: LargeFileItem[] = [];
  let totalSourceFiles = 0;
  let largeFileCount = 0;
  let veryLargeFileCount = 0;

  for (const filePath of filePaths) {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    const content = fileContents.get(filePath);
    if (!content) continue;

    totalSourceFiles++;
    const lines = estimateLineCount(content);

    if (lines >= VERY_LARGE_FILE_THRESHOLD_LINES) {
      veryLargeFileCount++;
      largeFileCount++;
      largeFiles.push({ path: filePath, lines, language: getLanguageFromPath(filePath) });
    } else if (lines >= LARGE_FILE_THRESHOLD_LINES) {
      largeFileCount++;
      largeFiles.push({ path: filePath, lines, language: getLanguageFromPath(filePath) });
    }
  }

  largeFiles.sort((a, b) => b.lines - a.lines);

  if (totalSourceFiles === 0) {
    return { complexityScore: 100, largeFiles: [] };
  }

  const largeFileRatio = largeFileCount / totalSourceFiles;
  const veryLargeFileRatio = veryLargeFileCount / totalSourceFiles;

  let score = 100;
  score -= Math.round(largeFileRatio * 40);
  score -= Math.round(veryLargeFileRatio * 30);

  return {
    complexityScore: Math.max(0, Math.min(100, score)),
    largeFiles: largeFiles.slice(0, 15),
  };
}
