import { useNavigate } from 'react-router-dom';
import { Github, Link, Unlink, RefreshCw } from 'lucide-react';
import { useGitHub } from '@/hooks/use-github';
import { useSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';

export function GitHubSettings() {
  const navigate = useNavigate();
  const gh = useGitHub();
  const { settings, updateGitHub } = useSettings();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">GitHub</h2>
        <p className="text-sm text-muted-foreground">Manage your GitHub integration.</p>
      </div>

      {gh.connected && gh.githubUser ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-input bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Connected Account</h3>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={gh.githubUser.avatar_url}
                alt={gh.githubUser.login}
                className="h-14 w-14 rounded-full ring-2 ring-border"
              />
              <div>
                <p className="text-sm font-medium">{gh.githubUser.name || gh.githubUser.login}</p>
                <p className="text-xs text-muted-foreground">@{gh.githubUser.login}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {gh.repositories.length} repositories
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-input bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Defaults</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Default Repository</label>
                <select
                  value={settings.github.defaultRepository}
                  onChange={(e) => updateGitHub({ defaultRepository: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select repository...</option>
                  {gh.repositories.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {settings.github.defaultRepository && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Default Branch</label>
                  <select
                    value={settings.github.defaultBranch}
                    onChange={(e) => updateGitHub({ defaultBranch: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {gh.branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => gh.refreshConnection()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reconnect
            </Button>
            <Button
              variant="outline"
              onClick={() => gh.disconnect()}
              disabled={gh.disconnecting}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Unlink className="h-4 w-4" />
              {gh.disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-input p-8 text-center">
          <Github className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No GitHub account connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect your GitHub account to access repositories and pull requests.
          </p>
          <Button onClick={() => navigate('/github')} className="mt-4 gap-2">
            <Link className="h-4 w-4" />
            Connect GitHub
          </Button>
        </div>
      )}
    </div>
  );
}
