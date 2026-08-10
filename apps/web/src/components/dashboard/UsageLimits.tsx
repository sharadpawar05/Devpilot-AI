import { memo } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';

export const UsageLimits = memo(function UsageLimits() {
  const { data: usage, isLoading } = useUsage();

  if (isLoading || !usage) return null;

  const isNearLimit = (used: number, limit: number) => used >= limit * 0.8;
  const isAtLimit = (used: number, limit: number) => used >= limit;

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Usage this month</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{usage.period}</span>
      </div>
      <div className="space-y-3">
        <UsageRow
          label="Health scans"
          used={usage.healthScans.used}
          limit={usage.healthScans.limit}
          nearLimit={isNearLimit(usage.healthScans.used, usage.healthScans.limit)}
          atLimit={isAtLimit(usage.healthScans.used, usage.healthScans.limit)}
        />
        <UsageRow
          label="AI reports"
          used={usage.aiReports.used}
          limit={usage.aiReports.limit}
          nearLimit={isNearLimit(usage.aiReports.used, usage.aiReports.limit)}
          atLimit={isAtLimit(usage.aiReports.used, usage.aiReports.limit)}
        />
        <UsageRow
          label="AI chat"
          used={usage.aiChat.used}
          limit={usage.aiChat.limit}
          nearLimit={isNearLimit(usage.aiChat.used, usage.aiChat.limit)}
          atLimit={isAtLimit(usage.aiChat.used, usage.aiChat.limit)}
        />
        <UsageRow
          label="Repositories"
          used={usage.repositories.used}
          limit={usage.repositories.limit}
          nearLimit={isNearLimit(usage.repositories.used, usage.repositories.limit)}
          atLimit={isAtLimit(usage.repositories.used, usage.repositories.limit)}
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
  const percentage = Math.min((used / limit) * 100, 100);
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
          Free plan limit reached
        </div>
      )}
    </div>
  );
}
