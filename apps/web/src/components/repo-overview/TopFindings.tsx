import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepoHealthDetail, HealthSeverity, HealthCheckStatus } from '@/lib/repo-overview';

interface SeverityGroup {
  severity: HealthSeverity | 'passed' | 'not_applicable';
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
    severity: 'low',
    label: 'Low',
    icon: Info,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    severity: 'not_applicable',
    label: 'Not Applicable',
    icon: CheckCircle2,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    borderColor: 'border-slate-200 dark:border-slate-800',
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

function isNotApplicableOrMeasured(status: HealthCheckStatus): boolean {
  return status === 'not_applicable' || status === 'not_measured';
}

function renderEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (value.length <= 3) return value.join(', ');
    return `${value.slice(0, 3).join(', ')} +${value.length - 3} more`;
  }
  if (typeof value === 'object') {
    // For nested objects, show key count or specific fields
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return 'None';
    if (keys.length <= 3) {
      return keys
        .map((k) => {
          const v = (value as Record<string, unknown>)[k];
          return `${k}: ${renderEvidenceValue(v)}`;
        })
        .join(', ');
    }
    return `${keys.length} fields`;
  }
  return String(value);
}

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
                .filter(([_, v]) => {
                  if (v === null || v === undefined) return false;
                  if (typeof v === 'string' && v === '') return false;
                  if (Array.isArray(v) && v.length === 0) return false;
                  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
                    return false;
                  return true;
                })
                .slice(0, 5)
                .map(([key, value]) => {
                  const rendered = renderEvidenceValue(value);
                  if (!rendered) return null;
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <span className="font-medium">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:
                      </span>
                      <span className="font-mono">{rendered}</span>
                    </span>
                  );
                })}
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
    let items: RepoHealthDetail[];
    if (group.severity === 'passed') {
      // Only actual passed checks
      items = details.filter((d) => d.passed && !isNotApplicableOrMeasured(d.status));
    } else if (group.severity === 'not_applicable') {
      // NOT_MEASURED and NOT_APPlicable checks
      items = details.filter((d) => isNotApplicableOrMeasured(d.status));
    } else {
      // Failed checks with specific severity, excluding NOT_MEASURED
      items = details.filter(
        (d) => !d.passed && d.severity === group.severity && !isNotApplicableOrMeasured(d.status),
      );
    }
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
