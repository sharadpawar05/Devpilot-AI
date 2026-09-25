// ─── Coverage Report Parsing ─────────────────────────────────────────────────
//
// Parses committed coverage reports into a single coverage percentage.
// Supports istanbul JSON summaries (coverage-summary.json) and lcov.info.

export interface CoverageFile {
  path: string;
  content: string;
}

function parseIstanbulSummary(content: string): number | undefined {
  try {
    const data = JSON.parse(content) as {
      total?: { statements?: { pct?: unknown }; lines?: { pct?: unknown } };
    };
    const statements = data.total?.statements?.pct;
    if (typeof statements === 'number' && Number.isFinite(statements)) return statements;
    const lines = data.total?.lines?.pct;
    if (typeof lines === 'number' && Number.isFinite(lines)) return lines;
    return undefined;
  } catch {
    return undefined;
  }
}

function parseLcov(content: string): number | undefined {
  let found = 0;
  let hit = 0;
  for (const line of content.split('\n')) {
    if (line.startsWith('LF:')) {
      const value = Number.parseInt(line.slice(3).trim(), 10);
      if (Number.isFinite(value)) found += value;
    } else if (line.startsWith('LH:')) {
      const value = Number.parseInt(line.slice(3).trim(), 10);
      if (Number.isFinite(value)) hit += value;
    }
  }
  if (found <= 0) return undefined;
  return Math.round((hit / found) * 1000) / 10;
}

/**
 * Extracts coverage % from committed coverage reports.
 *
 * Preference order:
 * 1. istanbul `coverage-summary.json` (total.statements.pct, falling back to total.lines.pct)
 * 2. `lcov.info` (summed LH/LF line rate)
 * 3. any other file that parses as an istanbul summary
 *
 * Returns undefined when no report could be parsed.
 */
export function parseCoverageReports(files: CoverageFile[]): number | undefined {
  let coverage: number | undefined;

  for (const file of files) {
    if (!file.path.includes('coverage-summary.json')) continue;
    coverage = parseIstanbulSummary(file.content);
    if (coverage !== undefined) break;
  }

  if (coverage === undefined) {
    for (const file of files) {
      if (!file.path.toLowerCase().includes('lcov.info')) continue;
      coverage = parseLcov(file.content);
      if (coverage !== undefined) break;
    }
  }

  if (coverage === undefined) {
    for (const file of files) {
      coverage = parseIstanbulSummary(file.content);
      if (coverage !== undefined) break;
    }
  }

  if (coverage === undefined) return undefined;
  return Math.min(100, Math.max(0, coverage));
}
