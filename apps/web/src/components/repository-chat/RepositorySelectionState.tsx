import { FolderSearch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GitHubContextValue } from '@/hooks/use-github';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface RepositorySelectionStateProps {
  gh: GitHubContextValue;
  selectedRepoFullName: string;
  selectedBranch: string;
  onRepoSelect: (fullName: string) => void;
  onBranchSelect: (branch: string) => void;
  onIndex: (owner: string, repo: string, branch: string) => void;
}

export function RepositorySelectionState({
  gh,
  selectedRepoFullName,
  selectedBranch,
  onRepoSelect,
  onBranchSelect,
  onIndex,
}: RepositorySelectionStateProps) {
  const handleRepoChange = (fullName: string) => {
    onRepoSelect(fullName);
    onBranchSelect('main');
    if (fullName) {
      const [owner, repo] = fullName.split('/');
      gh.fetchBranches(owner, repo);
    }
  };

  const handleIndex = () => {
    if (selectedRepoFullName) {
      const [owner, repo] = selectedRepoFullName.split('/');
      onIndex(owner, repo, selectedBranch);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <FolderSearch className="h-8 w-8 text-muted-foreground" />
        </div>

        <h2 className="text-xl font-bold tracking-tight">Select a Repository</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a repository to begin chatting with your codebase.
        </p>

        <div className="mt-8 space-y-4 text-left">
          <div className="relative">
            <label className="mb-1.5 block text-sm font-medium">Repository</label>
            <select
              value={selectedRepoFullName}
              onChange={(e) => handleRepoChange(e.target.value)}
              className={`${selectClass} appearance-none pr-10`}
            >
              <option value="">Select a repository...</option>
              {gh.repositories.map((r) => (
                <option key={r.full_name} value={r.full_name}>
                  {r.full_name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {selectedRepoFullName && (gh.branches?.length ?? 0) > 0 && (
            <div className="relative">
              <label className="mb-1.5 block text-sm font-medium">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => onBranchSelect(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
              >
                {gh.branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} {b.is_default ? '(default)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!selectedRepoFullName}
            onClick={handleIndex}
          >
            Select Repository
          </Button>
        </div>

        {(gh.repositories?.length ?? 0) > 0 && (
          <div className="mt-8 border-t border-input pt-6">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Recent repositories</p>
            <div className="space-y-1.5">
              {gh.repositories.slice(0, 5).map((r) => (
                <button
                  key={r.full_name}
                  type="button"
                  onClick={() => handleRepoChange(r.full_name)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    selectedRepoFullName === r.full_name ? 'bg-muted' : ''
                  }`}
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-muted-foreground">{r.language || 'No language'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
