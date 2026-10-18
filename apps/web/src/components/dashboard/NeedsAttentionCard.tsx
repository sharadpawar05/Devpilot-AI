import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RepoHealthDetail, HealthSeverity, HealthCheckStatus } from '@/lib/repo-overview';

const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_STYLES: Record<HealthSeverity, { badge: string; icon: typeof XCircle }> = {
  critical: {
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    icon: XCircle,
  },
  high: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    icon: AlertTriangle,
  },
  medium: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  low: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Info,
  },
};

function isNotMeasuredOrApplicable(status: HealthCheckStatus | undefined): boolean {
  return status === 'not_measured' || status === 'not_applicable';
}

function isActionableFinding(detail: RepoHealthDetail): boolean {
  if (isNotMeasuredOrApplicable(detail.status)) return false;
  if (detail.passed) return false;
  return true;
}

const UNCOVERED_TESTS_COPY = /^(\d+) test file\(s\) found but (.+)$/;

function getFindingCopy(detail: RepoHealthDetail): { title: string; description: string } {
  const description = detail.failedDescription ?? '';
  if (detail.id === 'test-coverage') {
    const match = UNCOVERED_TESTS_COPY.exec(description);
    if (match) {
      const clause =
        match[2] === 'no coverage report available' ? 'no coverage report is available' : match[2];
      return {
        title: `${detail.name} — Coverage not measured`,
        description: `${match[1]} test files detected, but ${clause}.`,
      };
    }
  }
  return { title: detail.name, description };
}

interface NeedsAttentionCardProps {
  details: RepoHealthDetail[] | null | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  hasRepo: boolean;
}

export const NeedsAttentionCard = memo(function NeedsAttentionCard({
  details,
  isLoading,
  error,
  onRetry,
  hasRepo,
}: NeedsAttentionCardProps) {
  const navigate = useNavigate();

  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Needs Attention</h3>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm" aria-busy="true">
        {header}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-56 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
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

  if (!hasRepo) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        {header}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">No repository selected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a repository to see what needs attention.
          </p>
        </div>
      </div>
    );
  }

  const findings = (details ?? [])
    .filter(isActionableFinding)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, 5);

  if (findings.length === 0) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        {header}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-sm font-medium">No major issues detected.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All measured checks are passing for this repository.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => navigate('/health-overview')}
          >
            View Health Report
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      {header}
      <ul className="space-y-3">
        {findings.map((detail) => {
          const style = SEVERITY_STYLES[detail.severity] ?? SEVERITY_STYLES.medium;
          const Icon = style.icon;
          const copy = getFindingCopy(detail);
          return (
            <li key={detail.id} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  style.badge,
                )}
              >
                <Icon className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 text-sm font-medium">{copy.title}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      style.badge,
                    )}
                  >
                    {detail.severity}
                  </span>
                </div>
                {copy.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {copy.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full gap-1.5"
        onClick={() => navigate('/health-overview')}
        aria-label="View all findings in health report"
      >
        View All Findings
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});
