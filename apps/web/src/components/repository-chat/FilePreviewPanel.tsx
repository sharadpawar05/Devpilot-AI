import { FileCode, Eye, Sparkles } from 'lucide-react';

interface FilePreviewPanelProps {
  file: string | null;
}

export function FilePreviewPanel({ file }: FilePreviewPanelProps) {
  if (!file) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
        role="status"
        aria-label="No file selected"
      >
        <div className="rounded-2xl border border-dashed bg-muted/30 p-4 animate-scale-in">
          <Eye className="h-8 w-8 text-muted-foreground/60" aria-hidden />
        </div>
        <p className="text-sm font-medium">No file selected</p>
        <p className="max-w-[240px] text-xs text-muted-foreground">
          Select a file in the explorer to preview it here.
        </p>
      </div>
    );
  }

  const fileName = file.split('/').pop() ?? file;
  const dirName = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';

  return (
    <div className="flex h-full min-h-0 flex-col animate-fade-in">
      <div className="flex items-center gap-2 border-b bg-card/50 px-4 py-2.5">
        <FileCode className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file}>
            {fileName}
          </p>
          {dirName && (
            <p className="truncate text-xs text-muted-foreground" title={dirName}>
              {dirName}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
          <Sparkles className="h-8 w-8 text-primary/60" aria-hidden />
        </div>
        <p className="text-sm font-medium">Preview ready</p>
        <p className="max-w-[260px] text-xs text-muted-foreground">
          Ask the chat about <span className="font-mono text-foreground">{fileName}</span> to get
          insights, explanations, and suggestions.
        </p>
      </div>
    </div>
  );
}
