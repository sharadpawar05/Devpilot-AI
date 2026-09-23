import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, Search } from 'lucide-react';
import type { RepoFile } from '@/hooks/use-repository-chat';

interface RepositoryTreeProps {
  tree: RepoFile[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}

function TreeItem({
  node,
  depth,
  onFileSelect,
  selectedFile,
}: {
  node: RepoFile;
  depth: number;
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === 'dir') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 active:scale-[0.99]"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onFileSelect?.(node.path)}
      aria-label={`Preview file ${node.path}`}
      aria-current={selectedFile === node.path ? 'true' : undefined}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60 active:scale-[0.99] ${
        selectedFile === node.path ? 'bg-accent text-accent-foreground shadow-sm' : ''
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function RepositoryTree({ tree, onFileSelect, selectedFile }: RepositoryTreeProps) {
  const [search, setSearch] = useState('');

  const filterTree = useCallback((nodes: RepoFile[], query: string): RepoFile[] => {
    if (!query) return nodes;
    return nodes
      .map((node) => {
        if (node.type === 'dir' && node.children) {
          const filtered = filterTree(node.children, query);
          if (filtered.length > 0) {
            return { ...node, children: filtered };
          }
        }
        if (node.name.toLowerCase().includes(query.toLowerCase())) {
          return node;
        }
        return null;
      })
      .filter(Boolean) as RepoFile[];
  }, []);

  const filteredTree = search ? filterTree(tree, search) : tree;

  return (
    <div className="flex flex-col">
      <div className="relative mb-2">
        <Search
          className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="repo-tree-search" className="sr-only">
          Search files
        </label>
        <input
          id="repo-tree-search"
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-1.5 pl-7 pr-2 text-xs shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        {(filteredTree?.length ?? 0) === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {search ? 'No files match your search' : 'No files found'}
          </p>
        ) : (
          filteredTree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
