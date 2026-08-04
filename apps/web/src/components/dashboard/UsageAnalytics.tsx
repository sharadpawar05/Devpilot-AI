import { memo } from 'react';
import { Zap, Coins, Clock, Github, GitPullRequest, Calendar } from 'lucide-react';

interface UsageAnalyticsProps {
  aiRequestsToday: number;
  totalReviews: number;
  avgReviewTime: string;
  tokensUsed: number;
  githubRepos: number;
  openPRs: number;
  connectedSince: string | null;
}

export const UsageAnalytics = memo(function UsageAnalytics({
  aiRequestsToday,
  tokensUsed,
  avgReviewTime,
  githubRepos,
  openPRs,
  connectedSince,
}: UsageAnalyticsProps) {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Usage Analytics</h3>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            AI Usage
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={Zap}
              label="Requests Today"
              value={aiRequestsToday}
              color="text-amber-500"
            />
            <MetricCard
              icon={Coins}
              label="Tokens Used"
              value={formatTokens(tokensUsed)}
              color="text-blue-500"
            />
            <MetricCard
              icon={Clock}
              label="Avg Response"
              value={avgReviewTime}
              color="text-emerald-500"
            />
          </div>
        </div>
        <div className="border-t border-border/50" />
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GitHub
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard icon={Github} label="Repos" value={githubRepos} color="text-gray-500" />
            <MetricCard
              icon={GitPullRequest}
              label="Open PRs"
              value={openPRs}
              color="text-purple-500"
            />
            <MetricCard
              icon={Calendar}
              label="Connected"
              value={connectedSince ? formatDate(connectedSince) : 'N/A'}
              color="text-pink-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
