import { Github, ChevronDown, Loader2, RefreshCw, Folder, Clock, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RepositoryTree } from './RepositoryTree';
import type { GitHubContextValue } from '@/hooks/use-github';
import type { RepoFile } from '@/hooks/use-repository-chat';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface RepositorySidebarProps {
  gh: GitHubContextValue;
  tree: RepoFile[];
  indexedFiles: number;
  indexedAt: string | null;
  isIndexing: boolean;
  selectedRepoFullName: string;
  selectedBranch: string;
  onRepoSelect: (fullName: string) => void;
  onBranchSelect: (branch: string) => void;
  onIndex: (owner: string, repo: string, branch: string) => void;
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}

export function RepositorySidebar({
  gh,
  tree,
  indexedFiles,
  indexedAt,
  isIndexing,
  selectedRepoFullName,
  selectedBranch,
  onRepoSelect,
  onBranchSelect,
  onIndex,
  onFileSelect,
  selectedFile,
}: RepositorySidebarProps) {
  const handleRepoChange = (fullName: string) => {
    onRepoSelect(fullName);
    onBranchSelect('main');
    if (fullName) {
      const [owner, repo] = fullName.split('/');
      gh.fetchBranches(owner, repo);
    }
  };

  const handleBranchChange = (branch: string) => {
    onBranchSelect(branch);
  };

  const handleIndex = () => {
    if (selectedRepoFullName) {
      const [owner, repo] = selectedRepoFullName.split('/');
      onIndex(owner, repo, selectedBranch);
    }
  };

  return (
    <div className="flex h-full w-72 flex-col border-r border-input bg-card">
      <div className="border-b border-input p-4">
        <h3 className="mb-3 text-sm font-semibold">Repository</h3>

        <div className="space-y-3">
          <div className="relative">
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
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {selectedRepoFullName && gh.branches.length > 0 && (
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
              >
                {gh.branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} {b.is_default ? '(default)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}

          {selectedRepoFullName && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleIndex}
              disabled={isIndexing}
            >
              {isIndexing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Indexing...
                </>
              ) : tree.length > 0 ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh Index
                </>
              ) : (
                <>
                  <Folder className="mr-1.5 h-3.5 w-3.5" />
                  Index Repository
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {indexedFiles > 0 && (
        <div className="border-b border-input p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              {indexedFiles} files indexed
            </span>
            {indexedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(indexedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {tree.length > 0 ? (
          <RepositoryTree tree={tree} onFileSelect={onFileSelect} selectedFile={selectedFile} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Github className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {selectedRepoFullName
                ? 'Click "Index Repository" to get started'
                : 'Select a repository to begin'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
