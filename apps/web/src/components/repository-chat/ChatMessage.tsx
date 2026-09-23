import { FileCode, ExternalLink, Sparkles, User } from 'lucide-react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { cn } from '@/lib/utils';

interface ReferencedFilesPanelProps {
  files: string[];
  onFileClick?: (path: string) => void;
}

export function ReferencedFilesPanel({ files, onFileClick }: ReferencedFilesPanelProps) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-input bg-muted/40 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Referenced Files</p>
      <div className="flex flex-wrap gap-1.5">
        {files.map((file) => (
          <button
            key={file}
            type="button"
            onClick={() => onFileClick?.(file)}
            className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all duration-150 hover:bg-accent hover:shadow active:scale-[0.98]"
            aria-label={`Open file ${file}`}
          >
            <FileCode className="h-3 w-3 text-primary" aria-hidden />
            <span className="max-w-[200px] truncate">{file}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  usage?: { input: number; output: number; total: number };
  referencedFiles?: string[];
  onFileClick?: (path: string) => void;
}

export function ChatMessage({
  role,
  content,
  provider,
  model,
  latencyMs,
  usage,
  referencedFiles,
  onFileClick,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn('mb-5 flex animate-slide-up gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
      role="article"
      aria-label={isUser ? 'Your message' : 'Assistant message'}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground',
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-primary" />}
      </div>

      <div
        className={cn(
          'min-w-0 rounded-2xl px-4 py-3 shadow-sm transition-shadow duration-200',
          isUser
            ? 'max-w-[80%] rounded-tr-md bg-primary text-primary-foreground'
            : 'w-full rounded-tl-md border border-input bg-card hover:shadow-md',
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div>
            <MarkdownRenderer content={content} />
            {referencedFiles && referencedFiles.length > 0 && (
              <div className="mt-3">
                <ReferencedFilesPanel files={referencedFiles} onFileClick={onFileClick} />
              </div>
            )}
            {(provider || model || latencyMs || usage) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-input/60 pt-2 text-xs text-muted-foreground">
                {provider && <span className="font-medium capitalize">{provider}</span>}
                {model && <span className="font-mono">{model}</span>}
                {latencyMs ? <span>{(latencyMs / 1000).toFixed(1)}s</span> : null}
                {usage ? <span>{usage.total.toLocaleString()} tokens</span> : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
