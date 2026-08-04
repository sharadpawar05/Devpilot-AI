import { memo } from 'react';
import type { DateRange } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  active: DateRange;
  onChange: (range: DateRange) => void;
  onExport?: (format: 'pdf' | 'csv' | 'json') => void;
}

const ranges: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
];

export const FilterBar = memo(function FilterBar({ active, onChange, onExport }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => onChange(r.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              active === r.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {onExport && (
        <div className="flex gap-1.5">
          {(['csv', 'json', 'pdf'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onExport(fmt)}
              className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Export {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
