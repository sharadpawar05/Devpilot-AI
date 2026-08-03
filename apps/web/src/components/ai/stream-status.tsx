import { CheckCircle, AlertCircle, Clock, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamStatusProps {
  isStreaming: boolean;
  error: { code: string; message: string } | null;
  metadata: {
    provider: string;
    model: string;
    latencyMs: number;
    tokens: { input: number; output: number; total: number };
  } | null;
  className?: string;
}

export function StreamStatus({ isStreaming, error, metadata, className }: StreamStatusProps) {
  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-destructive', className)}>
        <AlertCircle className="h-4 w-4" />
        <span>{error.message}</span>
      </div>
    );
  }

  if (isStreaming) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span>Streaming response...</span>
      </div>
    );
  }

  if (metadata) {
    return (
      <div className={cn('flex items-center gap-4 text-xs text-muted-foreground', className)}>
        <div className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          <span>{metadata.provider}</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          <span>{metadata.model}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{(metadata.latencyMs / 1000).toFixed(1)}s</span>
        </div>
        <span>{metadata.tokens.total} tokens</span>
      </div>
    );
  }

  return null;
}
