import { Loader2, Copy, Check, Download, RotateCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CodeReviewResponse } from '@/hooks/use-code-review';

interface ReviewHeaderProps {
  result: CodeReviewResponse;
  providerLabel: string;
  score: number | null;
  copied: boolean;
  showFixMode: boolean;
  isFixLoading: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onRetry: () => void;
  onToggleFix: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 9) return 'text-green-500';
  if (score >= 7) return 'text-blue-500';
  if (score >= 5) return 'text-amber-500';
  return 'text-red-500';
}

export function ReviewHeader({
  result,
  providerLabel,
  score,
  copied,
  showFixMode,
  isFixLoading,
  onCopy,
  onDownload,
  onRetry,
  onToggleFix,
}: ReviewHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{providerLabel}</span>
        <span className="h-3 w-px bg-border" />
        <span>{(result.latencyMs / 1000).toFixed(1)}s</span>
        <span>{result.usage.total.toLocaleString()} tokens</span>
        {score !== null && (
          <>
            <span className="h-3 w-px bg-border" />
            <span className={`font-semibold ${getScoreColor(score)}`}>{score}/10</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 px-2 text-xs"
          title="Re-run review"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-7 px-2 text-xs"
          title="Copy full report"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          className="h-7 px-2 text-xs"
          title="Download as Markdown"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-3 w-px bg-border" />
        <Button
          variant={showFixMode ? 'default' : 'ghost'}
          size="sm"
          onClick={onToggleFix}
          disabled={isFixLoading}
          className="h-7 px-2 text-xs"
          title="AI Fix Mode"
        >
          {isFixLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wrench className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">Fix</span>
        </Button>
      </div>
    </div>
  );
}
