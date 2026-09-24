import { memo } from 'react';
import { Zap, Coins, Clock, Github, GitPullRequest, Calendar, RotateCcw } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';

interface UsageAnalyticsProps {
  aiRequestsToday: number;
  totalReviews: number;
  avgReviewTime: string;
  githubRepos: number;
  openPRs: number;
  connectedSince: string | null;
}

function formatResetsOn(periodEnd: string | undefined): string | null {
  if (!periodEnd) return null;
  try {
    const date = new Date(periodEnd);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export const UsageAnalytics = memo(function UsageAnalytics({
  aiRequestsToday,
  totalReviews,
  avgReviewTime,
  githubRepos,
  openPRs,
  connectedSince,
}: UsageAnalyticsProps) {
  const { data: usage, isPending, isFetching, isError, error, refetch } = useUsage();
  const usageLoading = (isPending || isFetching) && !usage;
  const usageError = isError && !usage;

  const creditsUsed = usage?.usage?.aiCredits;
  const creditsLimit = usage?.limits?.aiCredits;
  const creditsRemaining = usage?.remaining?.aiCredits;
  const hasCredits = typeof creditsUsed === 'number' && typeof creditsLimit === 'number';
  const percentage =
    hasCredits && creditsLimit > 0
      ? Math.min(Math.round((creditsUsed / creditsLimit) * 100), 100)
      : 0;
  const resetsOn = formatResetsOn(usage?.periodEnd);
  const nearLimit = hasCredits && creditsLimit > 0 && creditsUsed >= creditsLimit * 0.8;
  const atLimit = hasCredits && creditsLimit > 0 && creditsUsed >= creditsLimit;

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Usage</h3>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            AI Credits
          </p>
          {usageLoading && (
            <div className="rounded-xl border border-input bg-muted/30 p-4" aria-busy="true">
              <div className="mb-2 h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          )}
          {!usageLoading && usageError && (
            <div className="rounded-xl border border-input bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                {error instanceof Error && error.message
                  ? error.message
                  : 'Unable to load AI credit usage.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {!usageLoading && !usageError && !usage && (
            <div className="rounded-xl border border-input bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">No credit data available.</p>
            </div>
          )}
          {!usageLoading && !usageError && usage && hasCredits && (
            <div className="rounded-xl border border-input bg-muted/30 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {creditsUsed} / {creditsLimit}{' '}
                  <span className="font-normal text-muted-foreground">AI Credits Used</span>
                </p>
                <span
                  className={`text-xs font-medium ${
                    atLimit
                      ? 'text-red-600 dark:text-red-400'
                      : nearLimit
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {percentage}%
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={creditsUsed}
                aria-valuemin={0}
                aria-valuemax={creditsLimit}
                aria-label="AI credits used"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{typeof creditsRemaining === 'number' ? creditsRemaining : 0} remaining</span>
                {resetsOn && (
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Resets {resetsOn}
                  </span>
                )}
                {usage?.plan && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {usage.plan}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Activity
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={Zap}
              label="Requests Today"
              value={aiRequestsToday}
              color="text-amber-500"
            />
            <MetricCard
              icon={Coins}
              label="Total Reviews"
              value={typeof totalReviews === 'number' ? totalReviews : 0}
              color="text-blue-500"
            />
            <MetricCard
              icon={Clock}
              label="Avg Response"
              value={avgReviewTime}
              color="text-emerald-500"
            />
          </div>
        </div>

        <div className="border-t border-border/50" />
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GitHub
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard icon={Github} label="Repos" value={githubRepos} color="text-gray-500" />
            <MetricCard
              icon={GitPullRequest}
              label="Open PRs"
              value={openPRs}
              color="text-purple-500"
            />
            <MetricCard
              icon={Calendar}
              label="Connected"
              value={connectedSince ? formatDate(connectedSince) : 'N/A'}
              color="text-pink-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
