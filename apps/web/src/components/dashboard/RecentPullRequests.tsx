import { GitPullRequest, ExternalLink } from 'lucide-react';
import type { GitHubPull } from '@/hooks/use-github';

interface RecentPullRequestsProps {
  pulls: GitHubPull[];
  onOpenPR: (pr: GitHubPull) => void;
}

export function RecentPullRequests({ pulls, onOpenPR }: RecentPullRequestsProps) {
  if (pulls.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Recent Pull Requests</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <GitPullRequest className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No pull requests yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect GitHub and select a repository to see PRs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Pull Requests</h3>
        <span className="text-xs text-muted-foreground">{pulls.length} open</span>
      </div>
      <div className="space-y-2">
        {pulls.slice(0, 5).map((pr) => (
          <button
            key={pr.number}
            type="button"
            onClick={() => onOpenPR(pr)}
            className="flex w-full items-center justify-between rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                #{pr.number} - {pr.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                by {pr.user} &middot; +{pr.additions} -{pr.deletions}
              </p>
            </div>
            <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
