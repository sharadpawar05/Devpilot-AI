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
            className="cite-btn"
            aria-label={`Open file ${file}`}
          >
            <FileCode className="cite-icon" aria-hidden />
            <span className="cite-label max-w-[200px] truncate">{file}</span>
            <ExternalLink className="cite-chevron" aria-hidden />
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
  /** Tighter layout when rendered inside a message group */
  grouped?: boolean;
  /** Stagger delay (ms) for entrance animation */
  animationDelay?: number;
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
  grouped = false,
  animationDelay = 0,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex animate-message-in gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        grouped ? 'mb-1' : 'mb-4',
      )}
      style={animationDelay > 0 ? { animationDelay: `${animationDelay}ms` } : undefined}
      role="article"
      aria-label={isUser ? 'Your message' : 'Assistant message'}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full shadow-sm ring-2 ring-background',
          grouped ? 'h-7 w-7' : 'h-8 w-8',
          isUser ? 'gradient-user text-white' : 'gradient-assistant-icon text-primary',
        )}
        aria-hidden
      >
        {isUser ? (
          <User className={grouped ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        ) : (
          <Sparkles className={grouped ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 rounded-2xl px-4 py-3 shadow-sm transition-all duration-200',
          isUser
            ? 'gradient-user max-w-[85%] rounded-tr-md text-white shadow-primary/20 hover:shadow-lg hover:shadow-primary/25'
            : 'gradient-assistant w-full rounded-tl-md border border-input/80 hover:border-primary/20 hover:shadow-md',
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div>
            <MarkdownRenderer content={content} onCite={onFileClick} />
            {referencedFiles && referencedFiles.length > 0 && (
              <div className="mt-3">
                <ReferencedFilesPanel files={referencedFiles} onFileClick={onFileClick} />
              </div>
            )}
            {!grouped && (provider || model || latencyMs || usage) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-input/60 pt-2 text-xs text-muted-foreground">
                {provider && <span className="font-medium capitalize">{provider}</span>}
                {model && <span className="font-mono">{model}</span>}
                {latencyMs ? <span>{(latencyMs / 1000).toFixed(1)}s</span> : null}
                {usage ? <span>{usage.total.toLocaleString()} tokens</span> : null}
              </div>
            )}
            {grouped && latencyMs && (
              <div className="mt-2 text-right text-[11px] text-muted-foreground/80">
                {(latencyMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
