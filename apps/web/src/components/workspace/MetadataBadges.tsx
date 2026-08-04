import { cn } from '@/lib/utils';
import { PROVIDERS, type ProviderValue } from '@/lib/constants';

interface ProviderBadgeProps {
  provider: ProviderValue | string;
  className?: string;
}

function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  const info = PROVIDERS.find((p) => p.value === provider);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
        className,
      )}
    >
      {info?.label ?? provider}
    </span>
  );
}

interface TokenBadgeProps {
  tokens: number;
  className?: string;
}

function TokenBadge({ tokens, className }: TokenBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent bg-secondary/50 px-2 py-0.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
    >
      {tokens.toLocaleString()} tokens
    </span>
  );
}

interface LatencyBadgeProps {
  latencyMs: number;
  className?: string;
}

function LatencyBadge({ latencyMs, className }: LatencyBadgeProps) {
  const seconds = (latencyMs / 1000).toFixed(1);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {seconds}s
    </span>
  );
}

export { ProviderBadge, TokenBadge, LatencyBadge };
