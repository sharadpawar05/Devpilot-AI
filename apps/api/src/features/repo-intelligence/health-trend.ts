// ─── Health Trend ────────────────────────────────────────────────────────────
//
// Computes deltas between the current health result and the previous stored
// snapshot (repo_health_snapshots), powering trend indicators in the UI.

export type TrendDirection = 'up' | 'down' | 'stable';

export interface HealthMetricTrend {
  current: number;
  previous: number;
  change: number;
  direction: TrendDirection;
}

export interface HealthTrend {
  score: HealthMetricTrend;
  coverage: HealthMetricTrend | null;
  previousAt: string;
}

export interface HealthSnapshotPoint {
  commitSha: string;
  score: number;
  coverage: number | null;
  passedCount: number;
  failedCount: number;
  criticalCount: number;
  createdAt: string;
}

function toDirection(change: number): TrendDirection {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'stable';
}

function roundChange(value: number): number {
  return Math.round(value * 10) / 10;
}

export function extractCoverage(summary: unknown): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const value = (summary as { testCoverage?: unknown }).testCoverage;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildMetricTrend(
  current: number | null,
  previous: number | null,
): HealthMetricTrend | null {
  if (current === null || previous === null) return null;
  const change = roundChange(current - previous);
  return {
    current,
    previous,
    change,
    direction: toDirection(change),
  };
}

export function computeHealthTrend(
  current: { score: number; coverage: number | null },
  previous: { score: number; coverage: number | null; createdAt: Date | string },
): HealthTrend {
  const score = buildMetricTrend(current.score, previous.score) ?? {
    current: current.score,
    previous: current.score,
    change: 0,
    direction: 'stable' as const,
  };

  return {
    score,
    coverage: buildMetricTrend(current.coverage, previous.coverage),
    previousAt: (previous.createdAt instanceof Date
      ? previous.createdAt
      : new Date(previous.createdAt)
    ).toISOString(),
  };
}
