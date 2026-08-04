import { memo } from 'react';
import { Zap, Clock, Coins, CheckCircle } from 'lucide-react';
import type { ProviderUsage } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

interface ProviderAnalyticsProps {
  data: ProviderUsage[];
}

const providerColors: Record<string, string> = {
  Gemini: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  OpenAI: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Anthropic: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  OpenRouter: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

export const ProviderAnalytics = memo(function ProviderAnalytics({ data }: ProviderAnalyticsProps) {
  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">AI Provider Analytics</h3>
      <div className="space-y-3">
        {data.map((provider) => (
          <div
            key={provider.provider}
            className="rounded-xl border border-input p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    providerColors[provider.provider] || 'bg-muted',
                  )}
                >
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{provider.provider}</p>
                  <p className="text-xs text-muted-foreground">{provider.requests} requests</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">${provider.costEstimate.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">estimated cost</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Avg Response
                </div>
                <p className="mt-0.5 text-sm font-bold">
                  {(provider.avgResponseTime / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Coins className="h-3 w-3" />
                  Avg Tokens
                </div>
                <p className="mt-0.5 text-sm font-bold">{provider.avgTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  Success
                </div>
                <p className="mt-0.5 text-sm font-bold">{provider.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
