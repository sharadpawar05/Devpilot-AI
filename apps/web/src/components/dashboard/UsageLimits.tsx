import { memo } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';

export const UsageLimits = memo(function UsageLimits() {
  const { data: usage, isLoading } = useUsage();

  if (isLoading || !usage) return null;

  const isNearLimit = (used: number, limit: number) => used >= limit * 0.8;
  const isAtLimit = (used: number, limit: number) => used >= limit;

  const periodLabel = usage.periodStart
    ? usage.periodStart.slice(0, 7)
    : ((usage as { period?: string }).period ?? '');

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Usage this month</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{periodLabel}</span>
      </div>
      <div className="space-y-3">
        <UsageRow
          label="AI credits"
          used={usage.usage.aiCredits}
          limit={usage.limits.aiCredits}
          nearLimit={isNearLimit(usage.usage.aiCredits, usage.limits.aiCredits)}
          atLimit={isAtLimit(usage.usage.aiCredits, usage.limits.aiCredits)}
        />
        <UsageRow
          label="Health scans"
          used={usage.usage.healthScans}
          limit={usage.limits.healthScans}
          nearLimit={isNearLimit(usage.usage.healthScans, usage.limits.healthScans)}
          atLimit={isAtLimit(usage.usage.healthScans, usage.limits.healthScans)}
        />
        <UsageRow
          label="AI reports"
          used={usage.usage.aiReports}
          limit={usage.limits.aiReports}
          nearLimit={isNearLimit(usage.usage.aiReports, usage.limits.aiReports)}
          atLimit={isAtLimit(usage.usage.aiReports, usage.limits.aiReports)}
        />
        <UsageRow
          label="Repository chat"
          used={usage.usage.chatMessages}
          limit={usage.limits.chatMessages}
          nearLimit={isNearLimit(usage.usage.chatMessages, usage.limits.chatMessages)}
          atLimit={isAtLimit(usage.usage.chatMessages, usage.limits.chatMessages)}
        />
        <UsageRow
          label="Repositories"
          used={usage.usage.repositories}
          limit={usage.limits.repositories}
          nearLimit={isNearLimit(usage.usage.repositories, usage.limits.repositories)}
          atLimit={isAtLimit(usage.usage.repositories, usage.limits.repositories)}
        />
      </div>
    </div>
  );
});

function UsageRow({
  label,
  used,
  limit,
  nearLimit,
  atLimit,
}: {
  label: string;
  used: number;
  limit: number;
  nearLimit: boolean;
  atLimit: boolean;
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
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
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
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
    </div>
  );
}
