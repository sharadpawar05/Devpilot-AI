import { Github, ChevronDown, Loader2, RefreshCw, Folder, Clock, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RepositoryTree } from './RepositoryTree';
import { FilePreviewPanel } from './FilePreviewPanel';
import { SplitViewLayout } from '@/components/workspace/SplitViewLayout';
import type { GitHubContextValue } from '@/hooks/use-github';
import type { RepoFile } from '@/hooks/use-repository-chat';

const selectClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface RepositoryChatLayoutProps {
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
  children: React.ReactNode;
}

function ExplorerContent({
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
}: Omit<RepositoryChatLayoutProps, 'children'>) {
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-input p-4">
        <h3 className="mb-3 text-sm font-semibold">Repository</h3>
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="repo-select" className="sr-only">
              Select repository
            </label>
            <select
              id="repo-select"
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
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          {selectedRepoFullName && (gh.branches?.length ?? 0) > 0 && (
            <div className="relative">
              <label htmlFor="branch-select" className="sr-only">
                Select branch
              </label>
              <select
                id="branch-select"
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
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          )}

          {selectedRepoFullName && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleIndex}
              disabled={isIndexing}
              aria-label={isIndexing ? 'Indexing repository' : 'Index repository'}
            >
              {isIndexing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Indexing...
                </>
              ) : (tree?.length ?? 0) > 0 ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Refresh Index
                </>
              ) : (
                <>
                  <Folder className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Index Repository
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {indexedFiles > 0 && (
        <div className="shrink-0 border-b border-input p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" aria-hidden />
              {indexedFiles} files indexed
            </span>
            {indexedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {new Date(indexedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {(tree?.length ?? 0) > 0 ? (
          <RepositoryTree tree={tree} onFileSelect={onFileSelect} selectedFile={selectedFile} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Github className="mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
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

export function RepositoryChatLayout({
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
  children,
}: RepositoryChatLayoutProps) {
  const explorerProps = {
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
  };

  return (
    <SplitViewLayout
      className="h-full"
      storageKey="devpilot_repo_chat_layout"
      defaultMobilePanel="chat"
      panels={[
        {
          id: 'explorer',
          label: 'Explorer',
          content: <ExplorerContent {...explorerProps} />,
          defaultSize: 22,
          minSize: 14,
          maxSize: 40,
        },
        {
          id: 'preview',
          label: 'Preview',
          content: <FilePreviewPanel file={selectedFile ?? null} />,
          defaultSize: 28,
          minSize: 15,
          maxSize: 50,
        },
        {
          id: 'chat',
          label: 'Chat',
          content: <div className="flex h-full min-h-0 flex-col">{children}</div>,
          defaultSize: 50,
          minSize: 25,
        },
      ]}
    />
  );
}
