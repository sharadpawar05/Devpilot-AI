import { FileCode, ExternalLink } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';

interface ReferencedFilesPanelProps {
  files: string[];
  onFileClick?: (path: string) => void;
}

export function ReferencedFilesPanel({ files, onFileClick }: ReferencedFilesPanelProps) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-lg border border-input bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Referenced Files</p>
      <div className="flex flex-wrap gap-1.5">
        {files.map((file) => (
          <button
            key={file}
            type="button"
            onClick={() => onFileClick?.(file)}
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
          >
            <FileCode className="h-3 w-3 text-muted-foreground" />
            <span className="max-w-[200px] truncate">{file}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser ? 'bg-primary text-primary-foreground' : 'border border-input bg-card'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{content}</p>
        ) : (
          <div>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
            {referencedFiles && referencedFiles.length > 0 && (
              <div className="mt-3">
                <ReferencedFilesPanel files={referencedFiles} onFileClick={onFileClick} />
              </div>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {provider && <span>{provider}</span>}
              {model && <span>{model}</span>}
              {latencyMs && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
              {usage && <span>{usage.total.toLocaleString()} tokens</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
