import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from './ConfidenceBadge';
import { DiffViewer } from './DiffViewer';
import type { FixItem } from './types';

interface IssueCardProps {
  fix: FixItem;
  index: number;
  className?: string;
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    label: 'Error',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    dot: 'bg-yellow-500',
  },
  info: {
    icon: Info,
    label: 'Info',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-500',
  },
};

export function IssueCard({ fix, index, className }: IssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDiff, setShowDiff] = useState(true);
  const config = severityConfig[fix.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm transition-all',
        config.bg,
        className,
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn('mt-0.5 rounded-full p-1', config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-semibold uppercase', config.color)}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <ConfidenceBadge score={fix.confidence} />
          </div>
          <p className="mt-1 text-sm font-medium">{fix.description}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {fix.location}
          </div>
        </div>
        <div className="mt-1 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border/50 px-4 pb-4 space-y-4">
          {/* Explanation */}
          <div className="pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Explanation</h4>
            <p className="text-sm text-foreground leading-relaxed">{fix.explanation}</p>
          </div>

          {/* Code Comparison */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Original Code */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Original</h4>
              <pre className="overflow-x-auto rounded-md border border-destructive/20 bg-destructive/5 p-3 font-mono text-xs">
                <code>{fix.originalCode}</code>
              </pre>
            </div>

            {/* Fixed Code */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Fixed</h4>
              <pre className="overflow-x-auto rounded-md border border-green-500/20 bg-green-500/5 p-3 font-mono text-xs">
                <code>{fix.fixedCode}</code>
              </pre>
            </div>
          </div>

          {/* Diff Toggle */}
          {fix.diff && (
            <div>
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDiff ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Unified Diff
              </button>
              {showDiff && <DiffViewer diff={fix.diff} className="mt-2" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
