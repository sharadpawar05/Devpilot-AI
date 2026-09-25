import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  RefreshCw,
  FolderGit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendBadge, formatRelativeTime } from '@/components/repo-overview';
import type { RepoHealthCheck } from '@/lib/repo-overview';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 50) return 'Needs Attention';
  return 'Needs Work';
}

interface HealthSnapshotCardProps {
  repoFullName: string | null;
  health: RepoHealthCheck | null | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const HealthSnapshotCard = memo(function HealthSnapshotCard({
  repoFullName,
  health,
  isLoading,
  error,
  onRetry,
}: HealthSnapshotCardProps) {
  const navigate = useNavigate();

  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Engineering Health</h3>
      </div>
      {repoFullName && (
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <FolderGit2 className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[140px]">{repoFullName}</span>
        </span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm" aria-busy="true">
        {header}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        {header}
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!repoFullName) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        {header}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Shield className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">No repository selected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect GitHub and select a repository to view health.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => navigate('/github')}
          >
            Manage GitHub
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        {header}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Shield className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">No health data yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a health scan for this repository to see its score.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => navigate('/health-overview')}
          >
            Open Health Overview
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  const score = health.score ?? 0;
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  const passedCount = health.passedCount ?? 0;
  const failedCount = health.failedCount ?? 0;
  const criticalCount = health.criticalCount ?? 0;
  const warningCount = health.warningCount ?? 0;
  const notMeasuredCount = health.notMeasuredCount ?? 0;

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      {header}
      <div className="flex items-start gap-4">
        <div
          className="relative shrink-0"
          role="img"
          aria-label={`Health score ${score} out of 100`}
        >
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 60 60" aria-hidden="true">
            <circle
              cx="30"
              cy="30"
              r="28"
              fill="none"
              strokeWidth="4"
              className="stroke-muted/50"
            />
            <circle
              cx="30"
              cy="30"
              r="28"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className={cn('transition-all duration-500', getScoreRingColor(score))}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-lg font-bold tabular-nums', getScoreColor(score))}>
              {score}
            </span>
            <span className="text-[8px] font-medium text-muted-foreground uppercase">/100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-semibold', getScoreColor(score))}>
              {getScoreLabel(score)}
            </p>
            <TrendBadge trend={health.trend?.score ?? null} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {passedCount} passed
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {failedCount} failed
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {warningCount} warnings
              </span>
            )}
            {criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                {criticalCount} critical
              </span>
            )}
            {notMeasuredCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                {notMeasuredCount} not measured
              </span>
            )}
          </div>
          {health.updatedAt && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Updated {formatRelativeTime(health.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full gap-1.5"
        onClick={() => navigate('/health-overview')}
        aria-label="View full health report"
      >
        View Health Report
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});
