import { useNavigate } from 'react-router-dom';
import { Github, Link, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GitHubContextValue } from '@/hooks/use-github';

interface GitHubStatusCardProps {
  gh: GitHubContextValue;
}

export function GitHubStatusCard({ gh }: GitHubStatusCardProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">GitHub</h3>
        {gh.connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Disconnected
          </span>
        )}
      </div>

      {gh.connected && gh.githubUser ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={gh.githubUser.avatar_url}
              alt={gh.githubUser.login}
              className="h-10 w-10 rounded-full"
            />
            <div>
              <p className="text-sm font-medium">{gh.githubUser.name || gh.githubUser.login}</p>
              <p className="text-xs text-muted-foreground">@{gh.githubUser.login}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Folder className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{gh.repositories.length}</p>
              <p className="text-xs text-muted-foreground">Repos</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Github className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{gh.pulls.length}</p>
              <p className="text-xs text-muted-foreground">Open PRs</p>
            </div>
          </div>
          {gh.connectedAt && (
            <p className="text-xs text-muted-foreground">
              Connected since {new Date(gh.connectedAt).toLocaleDateString()}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate('/github')}
          >
            <Link className="mr-1.5 h-3.5 w-3.5" />
            Manage Connection
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your GitHub account to review PRs and analyze repositories.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate('/github')}
          >
            <Github className="mr-1.5 h-3.5 w-3.5" />
            Connect GitHub
          </Button>
        </div>
      )}
    </div>
  );
}
