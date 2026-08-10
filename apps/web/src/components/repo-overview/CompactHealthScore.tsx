import { Activity, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface CompactHealthScoreProps {
  health: RepoHealthCheck | undefined;
  onViewDetails?: () => void;
}

export function CompactHealthScore({ health, onViewDetails }: CompactHealthScoreProps) {
  if (!health) return null;

  const { score = 0, passedCount = 0, failedCount = 0, criticalCount = 0 } = health;
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4">
      <div className="flex items-center gap-3">
        {/* Score ring */}
        <div className="relative shrink-0">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 60 60">
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Activity className={cn('h-4 w-4', getScoreColor(score))} />
            <span className={cn('text-sm font-semibold', getScoreColor(score))}>
              {getScoreLabel(score)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
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
            {criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                {criticalCount} critical
              </span>
            )}
          </div>
        </div>

        {/* View details link */}
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
