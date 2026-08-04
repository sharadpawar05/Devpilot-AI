import { memo } from 'react';
import type { FeatureUsage } from '@/lib/analytics-types';

interface FeatureBreakdownProps {
  data: FeatureUsage[];
}

export const FeatureBreakdown = memo(function FeatureBreakdown({ data }: FeatureBreakdownProps) {
  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Feature Usage</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.feature}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm">{item.feature}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.count}</span>
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
