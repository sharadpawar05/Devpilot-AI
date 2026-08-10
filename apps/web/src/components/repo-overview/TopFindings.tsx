import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepoHealthDetail, HealthSeverity } from '@/lib/repo-overview';

interface SeverityGroup {
  severity: HealthSeverity | 'passed';
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SEVERITY_GROUPS: SeverityGroup[] = [
  {
    severity: 'critical',
    label: 'Critical',
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  {
    severity: 'high',
    label: 'High',
    icon: AlertTriangle,
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    severity: 'medium',
    label: 'Medium',
    icon: AlertTriangle,
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    severity: 'passed',
    label: 'Passed',
    icon: CheckCircle2,
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
];

interface FindingItemProps {
  detail: RepoHealthDetail;
}

function FindingItem({ detail }: FindingItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/50 bg-background/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent/50"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-foreground">{detail.name}</span>
        {detail.scorePenalty > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-red-600 dark:text-red-400">
            -{detail.scorePenalty}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
          <p className="text-xs text-muted-foreground">{detail.failedDescription}</p>
          {detail.evidence && Object.keys(detail.evidence).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(detail.evidence)
                .filter(([_, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0))
                .slice(0, 5)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <span className="font-medium">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:
                    </span>
                    <span className="font-mono">
                      {typeof value === 'boolean'
                        ? value
                          ? 'Yes'
                          : 'No'
                        : Array.isArray(value)
                          ? value.length
                          : String(value)}
                    </span>
                  </span>
                ))}
            </div>
          )}
          <p className="text-[11px] italic text-muted-foreground">{detail.recommendation}</p>
        </div>
      )}
    </div>
  );
}

interface TopFindingsProps {
  details: RepoHealthDetail[];
}

export function TopFindings({ details }: TopFindingsProps) {
  const groupedDetails = SEVERITY_GROUPS.map((group) => {
    const items =
      group.severity === 'passed'
        ? details.filter((d) => d.passed)
        : details.filter((d) => !d.passed && d.severity === group.severity);
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  if (groupedDetails.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Top Findings</h4>
      <div className="space-y-3">
        {groupedDetails.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.severity}
              className={cn('rounded-lg border p-3', group.borderColor, group.bgColor)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-4 w-4', group.color)} />
                <span className={cn('text-xs font-semibold', group.color)}>
                  {group.label} ({group.items.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.slice(0, 5).map((detail) => (
                  <FindingItem key={detail.id} detail={detail} />
                ))}
                {group.items.length > 5 && (
                  <p className="text-[10px] text-muted-foreground pl-5">
                    +{group.items.length - 5} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
