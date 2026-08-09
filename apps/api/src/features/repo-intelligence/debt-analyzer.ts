import type { TechDebtItem } from './types';

interface DebtPattern {
  pattern: RegExp;
  name: string;
  severity: TechDebtItem['severity'];
}

const DEBT_PATTERNS: DebtPattern[] = [
  { pattern: /\bTODO\b/gi, name: 'TODO comments', severity: 'low' },
  { pattern: /\bFIXME\b/gi, name: 'FIXME comments', severity: 'medium' },
  { pattern: /\bHACK\b/gi, name: 'HACK comments', severity: 'high' },
  { pattern: /\bXXX\b/gi, name: 'XXX comments', severity: 'medium' },
  { pattern: /\b@deprecated\b/gi, name: 'Deprecated APIs', severity: 'medium' },
  { pattern: /\beslint-disable\b/gi, name: 'ESLint disables', severity: 'low' },
  { pattern: /\b@ts-ignore\b/gi, name: 'TypeScript ignores', severity: 'medium' },
  { pattern: /\b@ts-expect-error\b/gi, name: 'TypeScript errors suppressed', severity: 'medium' },
  { pattern: /as\s+any\b/g, name: 'Type assertions (as any)', severity: 'medium' },
];

const MAX_DEBT_PATTERNS = 100;

export interface DebtAnalysisResult {
  debtItems: TechDebtItem[];
  debtScore: number;
}

export function analyzeDebt(
  filePaths: string[],
  fileContents: Map<string, string>,
): DebtAnalysisResult {
  const countsByPattern = new Map<
    string,
    { count: number; files: string[]; severity: TechDebtItem['severity'] }
  >();
  let totalDebt = 0;

  for (const filePath of filePaths) {
    const content = fileContents.get(filePath);
    if (!content) continue;

    const lines = content.split('\n');

    for (const debtPattern of DEBT_PATTERNS) {
      let patternCount = 0;

      for (const line of lines) {
        debtPattern.pattern.lastIndex = 0;
        const matches = line.match(debtPattern.pattern);
        if (matches) {
          patternCount += matches.length;
          if (patternCount > MAX_DEBT_PATTERNS) break;
        }
      }

      if (patternCount > 0) {
        const existing = countsByPattern.get(debtPattern.name);
        if (existing) {
          existing.count += patternCount;
          if (existing.files.length < 5) existing.files.push(filePath);
        } else {
          countsByPattern.set(debtPattern.name, {
            count: patternCount,
            files: [filePath],
            severity: debtPattern.severity,
          });
        }
        totalDebt += patternCount;
      }
    }
  }

  const debtItems: TechDebtItem[] = [];
  for (const [pattern, data] of countsByPattern) {
    debtItems.push({
      pattern,
      count: data.count,
      files: data.files,
      severity: data.severity,
    });
  }

  debtItems.sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
  });

  let score = 100;
  const criticalCount = debtItems.filter((d) => d.severity === 'critical').length;
  const highCount = debtItems.filter((d) => d.severity === 'high').length;
  const mediumCount = debtItems.filter((d) => d.severity === 'medium').length;
  const lowCount = debtItems.filter((d) => d.severity === 'low').length;

  score -= criticalCount * 15;
  score -= highCount * 8;
  score -= mediumCount * 3;
  score -= lowCount * 1;

  return {
    debtItems: debtItems.slice(0, 20),
    debtScore: Math.max(0, Math.min(100, score)),
  };
}
