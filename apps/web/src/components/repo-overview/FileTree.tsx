import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepoFileNode } from '@/lib/repo-overview';

interface FileTreeProps {
  tree: RepoFileNode[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
  className?: string;
  maxHeight?: string;
}

function TreeItem({
  node,
  depth,
  onFileSelect,
  selectedFile,
}: {
  node: RepoFileNode;
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
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted/50 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="truncate">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-xs text-muted-foreground">{node.children.length}</span>
          )}
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
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted/50 transition-colors',
        selectedFile === node.path && 'bg-muted',
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
      {node.size != null && (
        <span className="ml-auto text-xs text-muted-foreground">
          {node.size > 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`}
        </span>
      )}
    </button>
  );
}

export function FileTree({
  tree,
  onFileSelect,
  selectedFile,
  className,
  maxHeight = '500px',
}: FileTreeProps) {
  const [search, setSearch] = useState('');

  const filterTree = useCallback((nodes: RepoFileNode[], query: string): RepoFileNode[] => {
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
      .filter(Boolean) as RepoFileNode[];
  }, []);

  const filteredTree = search ? filterTree(tree, search) : tree;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-input bg-background py-1.5 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
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
