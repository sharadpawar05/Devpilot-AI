import { Clock, Coins, Zap } from 'lucide-react';

interface ReviewMetricsProps {
  latencyMs: number;
  tokens: { input: number; output: number; total: number };
}

export function ReviewMetrics({ latencyMs, tokens }: ReviewMetricsProps) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <MetricItem icon={Clock} label={`${(latencyMs / 1000).toFixed(1)}s`} />
      <MetricItem icon={Coins} label={`${tokens.total.toLocaleString()} tokens`} />
      <MetricItem
        icon={Zap}
        label={`${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out`}
      />
    </div>
  );
}

function MetricItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
