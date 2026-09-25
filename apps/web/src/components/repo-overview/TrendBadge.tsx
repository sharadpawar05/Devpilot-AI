import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthMetricTrend } from '@/lib/repo-overview';

export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function TrendBadge({
  trend,
  suffix = '',
  className,
}: {
  trend?: HealthMetricTrend | null;
  suffix?: string;
  className?: string;
}) {
  if (!trend) return null;

  const Icon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend.direction === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
        color,
        className,
      )}
      title={`Previous: ${trend.previous}${suffix}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {trend.change > 0 ? '+' : ''}
      {trend.change}
      {suffix}
    </span>
  );
}
