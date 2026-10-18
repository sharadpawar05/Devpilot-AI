import { memo } from 'react';
import { BarChart3, AlertTriangle, RefreshCw, HelpCircle, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUsage } from '@/hooks/use-usage';

const ENGINEERING_REPORTS_HELP =
  'Structured engineering reports generated from your repository data. Examples: Sprint Summary, Engineering Status, Incident Summary, Engineering Health Report, Release Notes, Repository Summary, Documentation and Test Generation.';

const CHAT_MESSAGES_HELP =
  'Messages sent from the Playground and from Repository Chat. Every message counts once against the monthly limit, regardless of which chat you use.';

export const UsageLimits = memo(function UsageLimits() {
  const { data: usage, isPending, isFetching, isError, error, refetch } = useUsage();

  const isLoading = isPending || isFetching;

  if (isLoading && !usage) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm" aria-busy="true">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Usage &amp; Limits</h3>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError && !usage) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Usage &amp; Limits</h3>
        </div>
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error && error.message
              ? error.message
              : 'Unable to load usage and limits.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const isNearLimit = (used: number, limit: number) => limit > 0 && used >= limit * 0.8;
  const isAtLimit = (used: number, limit: number) => limit > 0 && used >= limit;

  const creditsUsed = usage.usage.aiCredits;
  const creditsLimit = usage.limits.aiCredits;
  const creditsRemaining = Math.max(creditsLimit - creditsUsed, 0);
  const creditsPct =
    creditsLimit > 0 ? Math.min(Math.round((creditsUsed / creditsLimit) * 100), 100) : 0;
  const creditsNear = isNearLimit(creditsUsed, creditsLimit);
  const creditsAt = isAtLimit(creditsUsed, creditsLimit);

  const periodLabel = usage.periodEnd
    ? (() => {
        try {
          const d = new Date(usage.periodEnd);
          if (Number.isNaN(d.getTime())) return '';
          return `Resets ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } catch {
          return '';
        }
      })()
    : '';

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Usage &amp; Limits</h3>
        {periodLabel && (
          <span className="ml-auto text-[10px] text-muted-foreground">{periodLabel}</span>
        )}
      </div>
      <div className="space-y-3">
        {/* AI Credits — primary budget */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Coins className="h-3 w-3" />
              AI Credits
            </span>
            <span
              className={
                creditsAt
                  ? 'font-semibold text-red-600 dark:text-red-400'
                  : creditsNear
                    ? 'font-semibold text-amber-600 dark:text-amber-400'
                    : 'text-foreground'
              }
            >
              {creditsUsed} / {creditsLimit}
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={creditsUsed}
            aria-valuemin={0}
            aria-valuemax={creditsLimit}
            aria-label="AI Credits used"
          >
            <div
              className={`h-full rounded-full transition-all ${
                creditsAt ? 'bg-red-500' : creditsNear ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${creditsPct}%` }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{creditsRemaining} remaining</span>
            <span className="text-muted-foreground">{creditsPct}%</span>
          </div>
          {creditsAt && (
            <div className="mt-1.5 space-y-0.5 text-[10px]">
              <p className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                AI credits exhausted
              </p>
              <p className="text-red-600 dark:text-red-400">
                Your monthly AI allowance has been used.
                {periodLabel ? ` ${periodLabel}.` : ''}
              </p>
            </div>
          )}
        </div>

        <UsageRow
          label="Health Scans"
          used={usage.usage.healthScans}
          limit={usage.limits.healthScans}
          nearLimit={isNearLimit(usage.usage.healthScans, usage.limits.healthScans)}
          atLimit={isAtLimit(usage.usage.healthScans, usage.limits.healthScans)}
        />
        <UsageRowWithHelp
          label="Engineering Reports"
          help={ENGINEERING_REPORTS_HELP}
          used={usage.usage.aiReports}
          limit={usage.limits.aiReports}
          nearLimit={isNearLimit(usage.usage.aiReports, usage.limits.aiReports)}
          atLimit={isAtLimit(usage.usage.aiReports, usage.limits.aiReports)}
        />
        <UsageRowWithHelp
          label="AI Chat Messages"
          help={CHAT_MESSAGES_HELP}
          used={usage.usage.chatMessages}
          limit={usage.limits.chatMessages}
          nearLimit={isNearLimit(usage.usage.chatMessages, usage.limits.chatMessages)}
          atLimit={isAtLimit(usage.usage.chatMessages, usage.limits.chatMessages)}
        />
        <UsageRow
          label="Active Repositories"
          used={usage.usage.repositories}
          limit={usage.limits.repositories}
          nearLimit={isNearLimit(usage.usage.repositories, usage.limits.repositories)}
          atLimit={isAtLimit(usage.usage.repositories, usage.limits.repositories)}
          variant="inventory"
        />
      </div>
    </div>
  );
});

function UsageRowWithHelp({
  label,
  help,
  used,
  limit,
  nearLimit,
  atLimit,
}: {
  label: string;
  help: string;
  used: number;
  limit: number;
  nearLimit: boolean;
  atLimit: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          {label}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {help}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        <span
          className={
            atLimit
              ? 'font-semibold text-red-600 dark:text-red-400'
              : nearLimit
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'text-foreground'
          }
        >
          {used} / {limit}
        </span>
      </div>
      <QuotaBar used={used} limit={limit} nearLimit={nearLimit} atLimit={atLimit} label={label} />
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  nearLimit,
  atLimit,
  variant = 'quota',
}: {
  label: string;
  used: number;
  limit: number;
  nearLimit: boolean;
  atLimit: boolean;
  variant?: 'quota' | 'inventory';
}) {
  const isInventory = variant === 'inventory';
  const tone = isInventory
    ? 'text-foreground'
    : atLimit
      ? 'font-semibold text-red-600 dark:text-red-400'
      : nearLimit
        ? 'font-semibold text-amber-600 dark:text-amber-400'
        : 'text-foreground';

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={tone}>
          {used} / {limit}
          {isInventory ? ' used' : ''}
        </span>
      </div>
      <QuotaBar
        used={used}
        limit={limit}
        nearLimit={isInventory ? false : nearLimit}
        atLimit={isInventory ? false : atLimit}
        label={label}
      />
    </div>
  );
}

function QuotaBar({
  used,
  limit,
  nearLimit,
  atLimit,
  label,
}: {
  used: number;
  limit: number;
  nearLimit: boolean;
  atLimit: boolean;
  label: string;
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label} used`}
      >
        <div
          className={`h-full rounded-full transition-all ${
            atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {atLimit && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Plan limit reached
        </div>
      )}
    </>
  );
}
