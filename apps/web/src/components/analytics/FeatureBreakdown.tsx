import { memo } from 'react';
import type { FeatureUsageStat } from '@/hooks/use-analytics';

interface FeatureBreakdownProps {
  data: FeatureUsageStat[];
}

export const FeatureBreakdown = memo(function FeatureBreakdown({ data }: FeatureBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Feature Usage</h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No feature usage data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Feature Usage</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.feature}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm">{item.feature}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.count} sessions</span>
                <span className="text-xs font-medium">{item.percentage}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
