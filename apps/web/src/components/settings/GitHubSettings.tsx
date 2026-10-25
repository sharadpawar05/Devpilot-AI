import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Link, Unlink, RefreshCw, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsQuery, useUpdateGitHub } from '@/hooks/use-settings';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export function GitHubSettings() {
  const navigate = useNavigate();
  const gh = useGitHub();
  const { session } = useAuth();
  const { addToast } = useToast();
  const { data, isLoading } = useSettingsQuery();
  const updateGitHub = useUpdateGitHub();

  const token = session?.accessToken;
  const savedRepo = data?.github.defaultRepository ?? '';
  const savedBranch = data?.github.defaultBranch ?? 'main';

  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [branchList, setBranchList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Seed the form from the saved server values once.
  useEffect(() => {
    if (data && !seeded) {
      setRepo(data.github.defaultRepository ?? '');
      setBranch(data.github.defaultBranch ?? 'main');
      setSeeded(true);
    }
  }, [data, seeded]);

  // Load branches for the chosen default repository so the branch dropdown
  // reflects that repo (gh.branches tracks the currently selected review repo).
  useEffect(() => {
    if (!repo || !token) {
      setBranchList([]);
      return;
    }
    const [owner, name] = repo.split('/');
    if (!owner || !name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const body = (await res.json()) as {
          success?: boolean;
          branches?: Array<{ name: string }>;
        };
        if (!cancelled && body.success && body.branches) {
          setBranchList(body.branches.map((b) => b.name));
        }
      } catch {
        // ignore — the saved branch still renders even if the list is stale
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, token]);

  if (isLoading || !data || !seeded) {
    return <GitHubSkeleton />;
  }

  const dirty = repo !== savedRepo || branch !== savedBranch;
  const saving = updateGitHub.isPending;

  const handleSave = async () => {
    setError(null);
    try {
      await updateGitHub.mutateAsync({
        defaultRepository: repo || null,
        defaultBranch: branch || null,
      });
      addToast('GitHub defaults saved', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save GitHub defaults');
    }
  };

  const handleReconnect = async () => {
    setError(null);
    // Kick off the GitHub OAuth flow and come back to this tab afterwards.
    const url = await gh.connect('/settings?tab=github');
    if (url) window.location.href = url;
  };

  const repoOptions = gh.repositories.map((r) => r.full_name);
  // Keep the saved repo selectable even if it is not in the loaded list yet
  // (still syncing / no longer accessible) so the value never silently resets.
  if (repo && !repoOptions.includes(repo)) repoOptions.unshift(repo);

  const branchOptions = [...branchList];
  if (branch && !branchOptions.includes(branch)) branchOptions.unshift(branch);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">GitHub</h2>
        <p className="text-sm text-muted-foreground">Manage your GitHub integration.</p>
      </div>

      {gh.connected && gh.githubUser ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-input bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
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
                <label htmlFor="gh-default-repo" className="mb-1.5 block text-sm font-medium">
                  Default Repository
                </label>
                <select
                  id="gh-default-repo"
                  value={repo}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    setBranch('main');
                  }}
                  disabled={saving}
                  className={selectCls}
                >
                  <option value="">Select repository...</option>
                  {repoOptions.map((full) => (
                    <option key={full} value={full}>
                      {full}
                    </option>
                  ))}
                </select>
              </div>

              {repo && (
                <div>
                  <label htmlFor="gh-default-branch" className="mb-1.5 block text-sm font-medium">
                    Default Branch
                  </label>
                  <select
                    id="gh-default-branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={saving}
                    className={selectCls}
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Defaults
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReconnect} className="gap-2">
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

const selectCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50';

function GitHubSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
