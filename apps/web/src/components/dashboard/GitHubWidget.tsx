import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Link, Folder, GitPullRequest, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GitHubContextValue } from '@/hooks/use-github';

interface GitHubWidgetProps {
  gh: GitHubContextValue;
  lastSyncedAt: string | null;
}

export const GitHubWidget = memo(function GitHubWidget({ gh, lastSyncedAt }: GitHubWidgetProps) {
  const navigate = useNavigate();

  if (!gh.connected) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">GitHub</h3>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Disconnected
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect your GitHub account to review PRs, analyze repositories, and collaborate with AI.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => navigate('/github')}
        >
          <Github className="h-3.5 w-3.5" />
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">GitHub</h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Connected
        </span>
      </div>

      {gh.githubUser && (
        <div className="mb-4 flex items-center gap-3">
          <img
            src={gh.githubUser.avatar_url}
            alt={gh.githubUser.login}
            className="h-10 w-10 rounded-full ring-2 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {gh.githubUser.name || gh.githubUser.login}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{gh.githubUser.login}</p>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Folder className="h-3 w-3" />
            Repositories
          </div>
          <p className="mt-1 text-lg font-bold">{gh.repositories.length}</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitPullRequest className="h-3 w-3" />
            Open PRs
          </div>
          <p className="mt-1 text-lg font-bold">{gh.pulls.length}</p>
        </div>
      </div>

      {gh.selectedRepoName && (
        <div className="mb-4 rounded-xl border border-input p-3">
          <p className="text-xs text-muted-foreground">Current repository</p>
          <p className="mt-0.5 truncate text-sm font-medium">{gh.selectedRepoName}</p>
          {gh.selectedBranch && (
            <p className="mt-0.5 text-xs text-muted-foreground">Branch: {gh.selectedBranch}</p>
          )}
        </div>
      )}

      {lastSyncedAt && (
        <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Synced {formatRelativeTime(lastSyncedAt)}
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => navigate('/github')}
      >
        <Link className="h-3.5 w-3.5" />
        Manage
      </Button>
    </div>
  );
});

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
