import { FileCode, FolderOpen } from 'lucide-react';

interface CodePreviewEmptyStateProps {
  variant?: 'no-selection' | 'no-repo';
}

const copy = {
  'no-selection': {
    title: 'No file selected',
    description: 'Select a file in the explorer to preview its contents here.',
  },
  'no-repo': {
    title: 'No repository selected',
    description: 'Choose a repository and index it to browse and preview files.',
  },
} as const;

export function CodePreviewEmptyState({ variant = 'no-selection' }: CodePreviewEmptyStateProps) {
  const { title, description } = copy[variant];
  const Icon = variant === 'no-repo' ? FolderOpen : FileCode;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
      role="status"
      aria-label={title}
      data-testid="code-preview-empty"
    >
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-xl"
          aria-hidden
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <Icon className="h-9 w-9 text-primary/70" aria-hidden />
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2" aria-hidden>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Browse
        </kbd>
        <span className="text-[10px] text-muted-foreground">files to the left</span>
      </div>
    </div>
  );
}
