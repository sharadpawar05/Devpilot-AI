import { cn } from '@/lib/utils';
import { ProviderBadge, TokenBadge, LatencyBadge } from './MetadataBadges';
import { CopyButton, DownloadButton, RegenerateButton } from '../shared/ActionButtons';

interface ResponseMetadata {
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  timestamp?: string;
}

interface ResponseActionBarProps {
  metadata: ResponseMetadata | null;
  responseContent?: string;
  filename?: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  className?: string;
  showTimestamp?: boolean;
  compact?: boolean;
}

function ResponseActionBar({
  metadata,
  responseContent,
  filename,
  isStreaming,
  onRegenerate,
  className,
  showTimestamp = false,
  compact = false,
}: ResponseActionBarProps) {
  if (!metadata) return null;

  const formattedTime = metadata.timestamp
    ? new Date(metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-background',
        compact ? 'px-4 py-2' : 'px-5 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 text-xs">
        {metadata.provider && <ProviderBadge provider={metadata.provider} />}
        {metadata.model && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{metadata.model}</span>
          </>
        )}
        {metadata.latencyMs != null && (
          <>
            <span className="text-muted-foreground">/</span>
            <LatencyBadge latencyMs={metadata.latencyMs} />
          </>
        )}
        {metadata.tokens?.total != null && (
          <>
            <span className="text-muted-foreground">·</span>
            <TokenBadge tokens={metadata.tokens.total} />
          </>
        )}
        {showTimestamp && formattedTime && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{formattedTime}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {responseContent && (
          <>
            <CopyButton text={responseContent} />
            <DownloadButton
              content={responseContent}
              filename={filename ?? `response-${Date.now()}.md`}
            />
          </>
        )}
        {onRegenerate && <RegenerateButton onRegenerate={onRegenerate} isLoading={isStreaming} />}
      </div>
    </div>
  );
}

interface StreamingIndicatorProps {
  className?: string;
}

function StreamingIndicator({ className }: StreamingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      <span>Streaming</span>
    </div>
  );
}

export { ResponseActionBar, StreamingIndicator };
export type { ResponseMetadata, ResponseActionBarProps };
