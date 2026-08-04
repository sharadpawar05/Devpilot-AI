import { memo } from 'react';
import {
  Folder,
  Shield,
  GitPullRequest,
  MessageSquare,
  FileCode,
  Clock,
  Lightbulb,
} from 'lucide-react';
import type { RepositoryInsight } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

interface RepositoryInsightsProps {
  data: RepositoryInsight[];
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
  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Repository Insights</h3>
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
              {repo.healthScore != null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    repo.healthScore >= 80
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : repo.healthScore >= 50
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  <Shield className="h-3 w-3" />
                  {repo.healthScore}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitPullRequest className="h-3 w-3" />
                {repo.prReviews} PR reviews
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {repo.repoChats} chats
              </span>
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                {repo.codeReviews} reviews
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(repo.lastActivity)}
              </span>
            </div>

            {repo.topSuggestions.length > 0 && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  Top Suggestions
                </p>
                <div className="flex flex-wrap gap-1">
                  {repo.topSuggestions.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
