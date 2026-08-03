import { Sparkles, AlertCircle } from 'lucide-react';
import { FixToolbar } from './FixToolbar';
import { IssueCard } from './IssueCard';
import type { FixResult } from './types';

interface FixPanelProps {
  result: FixResult | null;
  isLoading: boolean;
  error: string | null;
  provider: string;
  model: string;
  latencyMs: number;
  onRegenerate: () => void;
}

export function FixPanel({
  result,
  isLoading,
  error,
  provider,
  model,
  latencyMs,
  onRegenerate,
}: FixPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="mb-3 h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm font-medium">Generating fixes...</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Analyzing code and producing suggested fixes
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to generate fixes</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Click &quot;Fix Issues&quot; to generate suggested fixes for your code
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{result.summary}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {provider} / {model}
            </span>
            <span>·</span>
            <span>{latencyMs}ms</span>
            <span>·</span>
            <span>
              {result.fixes.length} fix{result.fixes.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <FixToolbar result={result} isGenerating={false} onRegenerate={onRegenerate} />

      {/* Fix List */}
      {result.fixes.length > 0 ? (
        <div className="space-y-3">
          {result.fixes.map((fix, i) => (
            <IssueCard key={i} fix={fix} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">No issues found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your code looks good! No fixes needed.
          </p>
        </div>
      )}
    </div>
  );
}
