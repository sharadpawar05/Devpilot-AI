import { StopCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface StreamControlsProps {
  isStreaming: boolean;
  hasContent: boolean;
  hasError: boolean;
  onStop?: () => void;
  onRetry?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

export function StreamControls({
  isStreaming,
  hasContent,
  hasError,
  onStop,
  onRetry,
  onCopy,
  onRegenerate,
  className,
}: StreamControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isStreaming && onStop && (
        <Button variant="outline" size="sm" onClick={onStop} className="gap-1.5">
          <StopCircle className="h-3.5 w-3.5" />
          Stop Generation
        </Button>
      )}

      {!isStreaming && hasError && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}

      {!isStreaming && hasContent && !hasError && onCopy && (
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}

      {!isStreaming && hasContent && !hasError && onRegenerate && (
        <Button variant="ghost" size="sm" onClick={onRegenerate} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </Button>
      )}
    </div>
  );
}
