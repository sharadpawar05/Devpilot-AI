import { memo } from 'react';
import { Folder, Clock, MessageSquare, Coins } from 'lucide-react';
import type { RepositoryActivity } from '@/hooks/use-analytics';

interface RepositoryInsightsProps {
  data: RepositoryActivity[];
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const RepositoryInsights = memo(function RepositoryInsights({
  data,
}: RepositoryInsightsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Repository Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Folder className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No repository activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect GitHub and start using AI features to see repository insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Repository Activity</h3>
        <span className="text-xs text-muted-foreground">{data.length} repositories</span>
      </div>
      <div className="space-y-3">
        {data.map((repo) => (
          <div
            key={repo.name}
            className="rounded-xl border border-input p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{repo.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{repo.sessionCount} sessions</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {repo.workflowTypes.length} features used
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                {repo.totalTokens.toLocaleString()} tokens
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(repo.lastActivity)}
              </span>
            </div>

            {repo.workflowTypes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {repo.workflowTypes.map((wt: string) => (
                  <span
                    key={wt}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {wt}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
