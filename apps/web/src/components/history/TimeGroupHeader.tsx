import { memo } from 'react';
import { cn } from '@/lib/utils';

interface TimeGroupHeaderProps {
  label: string;
  count: number;
  isFirst?: boolean;
}

export const TimeGroupHeader = memo(function TimeGroupHeader({
  label,
  count,
  isFirst,
}: TimeGroupHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', !isFirst && 'pt-4')}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
        {count}
      </span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
});
