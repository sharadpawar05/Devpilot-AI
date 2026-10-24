import { usageService, UsageLimitExceededError } from '@/core/usage';
import { repositoryIntelligenceService } from './repository-service';
import { extractCoverage } from './health-trend';
import type { HealthTrend } from './health-trend';
import type { HealthCheckDetail, RepositoryHealth, ScoreBreakdownItem } from './types';

interface HealthSnapshotRow {
  score: number;
  passedCount: number;
  failedCount: number;
  criticalCount: number;
  structuralScore: number;
  qualityScore: number;
  details: unknown;
  scoreBreakdown: unknown;
  summary: unknown;
  createdAt: Date;
}

function snapshotToHealth(
  row: HealthSnapshotRow,
  updatedAt: string,
  trend: HealthTrend | null,
): RepositoryHealth {
  const details = Array.isArray(row.details) ? (row.details as HealthCheckDetail[]) : [];
  return {
    score: row.score,
    passedCount: row.passedCount,
    failedCount: row.failedCount,
    warningCount: details.filter((d) => d.status === 'warning').length,
    notMeasuredCount: details.filter(
      (d) => d.status === 'not_measured' || d.status === 'not_applicable',
    ).length,
    criticalCount: row.criticalCount,
    details,
    scoreBreakdown: Array.isArray(row.scoreBreakdown)
      ? (row.scoreBreakdown as ScoreBreakdownItem[])
      : [],
    summary: {
      structuralScore: row.structuralScore,
      qualityScore: row.qualityScore,
      structuralWeight: 40,
      qualityWeight: 60,
      ...((row.summary as Record<string, unknown>) ?? {}),
    } as RepositoryHealth['summary'],
    updatedAt,
    trend,
  };
}

export interface MeteredHealthResult {
  health: RepositoryHealth;
  cached: boolean;
}

/** DB snapshots older than this are considered stale and trigger a re-scan. */
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Single-flight de-duplication for concurrent identical scans.
 *
 * Without this, two simultaneous requests for the same repo (e.g. a double
 * click, or two tabs) both miss the cache, both consume a HEALTH_SCAN, and
 * both run the scan — over-charging for one logical operation. In-flight
 * scans are keyed by user+owner+repo; later callers await the same promise
 * and share its single consume + result.
 */
const inFlightScans = new Map<string, Promise<MeteredHealthResult>>();

/**
 * Metered health scan shared by every route that needs repository health.
 *
 * - Serves the warm in-memory cache for free (no quota consumed).
 * - Serves the DB snapshot (per user + commit SHA, max 24h old) for free.
 * - Otherwise atomically consumes one HEALTH_SCAN quota before computing,
 *   and refunds it if the scan fails.
 * - Throws UsageLimitExceededError when the user has no scans left.
 */
export async function getMeteredHealth(
  userId: string,
  owner: string,
  repo: string,
): Promise<MeteredHealthResult> {
  // Single-flight: concurrent identical scans share one consume + scan.
  const key = `${userId}:${owner}/${repo}`;
  const existing = inFlightScans.get(key);
  if (existing) return existing;

  const run = (async () => {
    let consumed = false;
    try {
      // Warm in-memory cache: same result getHealth would return without
      // re-computing — serve it without charging a scan.
      const warm = repositoryIntelligenceService.getCachedHealth(userId, owner, repo);
      if (warm) {
        return { health: warm, cached: true };
      }

      const commitSha = await repositoryIntelligenceService.getLatestCommitSha(userId, owner, repo);

      if (commitSha) {
        const cached = await usageService.getHealthCache(userId, owner, repo, commitSha);
        const fresh =
          cached && Date.now() - cached.createdAt.getTime() < SNAPSHOT_MAX_AGE_MS ? cached : null;
        if (fresh) {
          const meta = await repositoryIntelligenceService.getHealthMeta(
            userId,
            owner,
            repo,
            { score: fresh.score, coverage: extractCoverage(fresh.summary) },
            { excludeCommitSha: commitSha, updatedAt: fresh.createdAt.toISOString() },
          );
          return { health: snapshotToHealth(fresh, meta.updatedAt, meta.trend), cached: true };
        }
      }

      const consume = await usageService.consumeQuota(userId, 'HEALTH_SCAN');
      if (!consume.allowed && consume.details) {
        throw new UsageLimitExceededError(consume.details);
      }
      consumed = true;

      const health = await repositoryIntelligenceService.getHealth(userId, owner, repo);

      if (commitSha) {
        await usageService
          .saveHealthCache(userId, owner, repo, commitSha, {
            score: health.score,
            passedCount: health.passedCount,
            failedCount: health.failedCount,
            criticalCount: health.criticalCount,
            structuralScore: health.summary.structuralScore,
            qualityScore: health.summary.qualityScore,
            details: health.details,
            scoreBreakdown: health.scoreBreakdown,
            summary: health.summary,
          })
          .catch(() => {
            // Best-effort cache save
          });
      }

      return { health, cached: false };
    } catch (error) {
      if (consumed) {
        try {
          await usageService.refundQuota(userId, 'HEALTH_SCAN');
        } catch {
          // Refund must not mask the original error
        }
      }
      throw error;
    }
  })();

  inFlightScans.set(key, run);
  try {
    return await run;
  } finally {
    inFlightScans.delete(key);
  }
}
