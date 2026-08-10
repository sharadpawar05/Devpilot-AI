import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock,
  Lightbulb,
  ArrowRight,
  Trophy,
  Target,
  FileCode,
  Lock,
  Package,
  Layers,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RepoHealthCheck,
  RepoHealthDetail,
  HealthSeverity,
  HealthCheckCategory,
  HealthActionType,
} from '@/lib/repo-overview';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; ring: string; icon: typeof CheckCircle2 }
> = {
  passed: {
    label: 'Passed',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    ring: 'ring-red-500/30',
    icon: XCircle,
  },
  warning: {
    label: 'Warning',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    ring: 'ring-amber-500/30',
    icon: XCircle,
  },
  partial: {
    label: 'Partial',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    ring: 'ring-orange-500/30',
    icon: XCircle,
  },
  not_applicable: {
    label: 'N/A',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-900/40',
    ring: 'ring-slate-500/30',
    icon: CheckCircle2,
  },
  not_measured: {
    label: 'Not Measured',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-900/40',
    ring: 'ring-slate-500/30',
    icon: CheckCircle2,
  },
};

const SEVERITY_CONFIG: Record<
  HealthSeverity,
  { label: string; color: string; bg: string; ring: string }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    ring: 'ring-red-500/30',
  },
  high: {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    ring: 'ring-orange-500/30',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    ring: 'ring-amber-500/30',
  },
  low: {
    label: 'Low',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    ring: 'ring-blue-500/30',
  },
};

const CATEGORY_CONFIG: Record<
  HealthCheckCategory,
  { label: string; color: string; bg: string; icon: typeof Target }
> = {
  structural: {
    label: 'Structural',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon: FileCode,
  },
  quality: {
    label: 'Quality',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    icon: Target,
  },
};

// Score breakdown category definitions — order matches reference layout
const SCORE_CATEGORIES = [
  {
    key: 'structural',
    label: 'Structural',
    icon: FileCode,
    color: 'blue' as const,
    summaryKey: 'structuralScore',
  },
  {
    key: 'quality',
    label: 'Quality',
    icon: Target,
    color: 'purple' as const,
    summaryKey: 'qualityScore',
  },
  {
    key: 'security',
    label: 'Security',
    icon: Lock,
    color: 'emerald' as const,
    summaryKey: 'securityScore',
  },
  {
    key: 'dependencies',
    label: 'Dependencies',
    icon: Package,
    color: 'amber' as const,
    summaryKey: 'dependencyScore',
  },
  {
    key: 'maintainability',
    label: 'Maintainability',
    icon: Layers,
    color: 'red' as const,
    summaryKey: 'maintainabilityScore',
  },
] as const;

// ─── Helper functions ────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 50) return 'Needs Attention';
  return 'Needs Work';
}

function getScoreBorderColor(score: number): string {
  if (score >= 80) return 'border-emerald-200 dark:border-emerald-800';
  if (score >= 60) return 'border-amber-200 dark:border-amber-800';
  return 'border-red-200 dark:border-red-800';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/30';
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/30';
  return 'bg-red-50 dark:bg-red-950/30';
}

function getProgressBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ─── SeverityBadge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: HealthSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
        config.color,
        config.bg,
        config.ring,
      )}
    >
      {config.label}
    </span>
  );
}

// ─── ScoreBreakdown (category-based with progress bars) ──────────────────────

function ScoreBreakdown({ summary }: { summary: NonNullable<RepoHealthCheck['summary']> }) {
  return (
    <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" />
        <span>Score Breakdown</span>
      </div>
      <div className="space-y-2.5">
        {SCORE_CATEGORIES.map(({ key, label, icon: Icon, summaryKey }) => {
          const score = summary[summaryKey as keyof typeof summary] as number | undefined;
          if (score === undefined) return null;
          return (
            <div key={key} className="flex items-center gap-3">
              <Icon className={cn('h-4 w-4 shrink-0', getTextColor(score))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <span className={cn('text-xs font-semibold tabular-nums', getTextColor(score))}>
                    {score}/100
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      getProgressBarColor(score),
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ExpandableRecommendation ────────────────────────────────────────────────

function ExpandableRecommendation({
  detail,
  onGenerate,
}: {
  detail: RepoHealthDetail;
  onGenerate?: (actionType: HealthActionType) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-border/50 bg-background/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        View Recommendation
      </button>

      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {/* Status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Status
            </p>
            <p className="text-xs text-foreground">{detail.failedDescription}</p>
          </div>

          {/* Evidence */}
          {detail.evidence && Object.keys(detail.evidence).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Evidence
              </p>
              <EvidenceDisplay evidence={detail.evidence} />
            </div>
          )}

          {/* Why it matters */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Why this matters
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{detail.whyItMatters}</p>
          </div>

          {/* Recommendation */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Recommendation
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{detail.recommendation}</p>
          </div>

          {/* Estimated effort */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Estimated effort:</span>
            <span>{detail.estimatedEffort}</span>
          </div>

          {/* Action button */}
          {detail.actionType !== 'none' && onGenerate && (
            <button
              type="button"
              onClick={() => onGenerate(detail.actionType)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Zap className="h-3 w-3" />
              {detail.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EvidenceDisplay ─────────────────────────────────────────────────────────

function EvidenceDisplay({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([_, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (entries.length === 0) return null;

  const formatValue = (value: unknown): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      if (value.length <= 3) {
        return value
          .map((v) => {
            if (typeof v === 'object' && v !== null) {
              const keys = Object.keys(v as Record<string, unknown>);
              if (keys.length <= 2) {
                return keys
                  .map((k) => `${k}: ${formatValue((v as Record<string, unknown>)[k])}`)
                  .join(', ');
              }
              return `{${keys.length} fields}`;
            }
            return formatValue(v);
          })
          .join(', ');
      }
      return `${value
        .slice(0, 3)
        .map((v) => {
          if (typeof v === 'object' && v !== null) {
            const keys = Object.keys(v as Record<string, unknown>);
            return `{${keys.length} fields}`;
          }
          return formatValue(v);
        })
        .join(', ')} +${value.length - 3} more`;
    }
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return 'None';
      if (keys.length <= 3) {
        return keys
          .map((k) => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`)
          .join(', ');
      }
      return `${keys.length} fields`;
    }
    return String(value);
  };

  const formatKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground"
        >
          <span className="font-medium">{formatKey(key)}:</span>
          <span className="font-mono">{formatValue(value)}</span>
        </span>
      ))}
    </div>
  );
}

// ─── HealthCard ──────────────────────────────────────────────────────────────

function HealthCard({
  detail,
  onGenerate,
}: {
  detail: RepoHealthDetail;
  onGenerate?: (actionType: HealthActionType) => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[detail.category];
  const statusConfig = STATUS_CONFIG[detail.status] || STATUS_CONFIG.failed;
  const StatusIcon = statusConfig.icon;

  if (detail.status === 'not_applicable' || detail.status === 'not_measured') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-950/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              statusConfig.bg,
            )}
          >
            <StatusIcon className={cn('h-3.5 w-3.5', statusConfig.color)} />
          </div>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {detail.name}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
              categoryConfig.color,
              categoryConfig.bg,
            )}
          >
            {categoryConfig.label}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
              statusConfig.color,
              statusConfig.bg,
              statusConfig.ring,
            )}
          >
            {statusConfig.label}
          </span>
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {detail.scorePenalty === 0 ? 'No penalty' : `-${detail.scorePenalty}`}
          </span>
        </div>
        {detail.evidence && (
          <div className="border-t border-border/50 px-4 py-2">
            <EvidenceDisplay evidence={detail.evidence} />
          </div>
        )}
      </div>
    );
  }

  if (detail.passed) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {detail.name}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
              categoryConfig.color,
              categoryConfig.bg,
            )}
          >
            {categoryConfig.label}
          </span>
          {detail.quality && <QualityMetrics quality={detail.quality} name={detail.name} />}
          <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">Passed</span>
        </div>
        {detail.evidence && (
          <div className="border-t border-border/50 px-4 py-2">
            <EvidenceDisplay evidence={detail.evidence} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <XCircle className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium text-red-800 dark:text-red-200">{detail.name}</span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
            categoryConfig.color,
            categoryConfig.bg,
          )}
        >
          {categoryConfig.label}
        </span>
        <SeverityBadge severity={detail.severity} />
        {detail.quality && <QualityMetrics quality={detail.quality} name={detail.name} />}
        <span className="ml-auto font-mono text-xs font-medium text-red-600 dark:text-red-400">
          -{detail.scorePenalty}
        </span>
      </div>
      <ExpandableRecommendation detail={detail} onGenerate={onGenerate} />
    </div>
  );
}

// ─── QualityMetrics ──────────────────────────────────────────────────────────

function QualityMetrics({
  quality,
  name,
}: {
  quality: NonNullable<RepoHealthDetail['quality']>;
  name: string;
}) {
  if (name === 'Test Coverage' && quality.coverage !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            quality.coverage >= 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : quality.coverage >= 60
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {quality.coverage}% coverage
        </span>
        {quality.testFileCount !== undefined && (
          <span className="text-muted-foreground">({quality.testFileCount} test files)</span>
        )}
      </div>
    );
  }

  if (name === 'README Quality' && quality.sectionsFound && quality.sectionsMissing) {
    const found = quality.sectionsFound.length;
    const total = found + quality.sectionsMissing.length;
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            found >= 4
              ? 'text-emerald-600 dark:text-emerald-400'
              : found >= 2
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {found}/{total} sections
        </span>
        {quality.sectionsMissing.length > 0 && (
          <span className="text-muted-foreground">
            (missing: {quality.sectionsMissing.slice(0, 2).join(', ')}
            {quality.sectionsMissing.length > 2 ? '...' : ''})
          </span>
        )}
      </div>
    );
  }

  if (name === 'CI/CD Pipeline' && quality.workflowCount !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            quality.workflowCount >= 3
              ? 'text-emerald-600 dark:text-emerald-400'
              : quality.workflowCount >= 1
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {quality.workflowCount} workflow{quality.workflowCount !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  if (name === 'Dependencies' && quality.totalDependencies !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          {quality.totalDependencies} packages
        </span>
        {quality.outdatedPercentage !== undefined && quality.outdatedPercentage > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            ({quality.outdatedPercentage}% outdated)
          </span>
        )}
      </div>
    );
  }

  if (name === 'Security' && quality.vulnerabilityCount !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {quality.vulnerabilityCount === 0 ? (
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            No vulnerabilities
          </span>
        ) : (
          <span className="font-mono font-semibold text-red-600 dark:text-red-400">
            {quality.vulnerabilityCount} vulnerabilities
            {quality.criticalVulnerabilities
              ? ` (${quality.criticalVulnerabilities} critical)`
              : ''}
            {quality.highVulnerabilities ? ` (${quality.highVulnerabilities} high)` : ''}
          </span>
        )}
      </div>
    );
  }

  if (name === 'Code Complexity' && quality.complexityScore !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            quality.complexityScore >= 70
              ? 'text-emerald-600 dark:text-emerald-400'
              : quality.complexityScore >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {quality.complexityScore}/100
        </span>
        {quality.largeFiles && quality.largeFiles.length > 0 && (
          <span className="text-muted-foreground">
            ({quality.largeFiles.length} large file{quality.largeFiles.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>
    );
  }

  if (name === 'Technical Debt' && quality.debtItems !== undefined) {
    const totalIndicators = quality.debtItems.reduce((sum, d) => sum + d.count, 0);
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            (quality.debtScore ?? 100) >= 70
              ? 'text-emerald-600 dark:text-emerald-400'
              : (quality.debtScore ?? 100) >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {totalIndicators} indicators
        </span>
        <span className="text-muted-foreground">
          ({quality.debtItems.length} pattern{quality.debtItems.length !== 1 ? 's' : ''})
        </span>
      </div>
    );
  }

  if (name === 'Code Hotspots' && quality.hotspots !== undefined) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'font-mono font-semibold',
            quality.hotspots.length <= 3
              ? 'text-emerald-600 dark:text-emerald-400'
              : quality.hotspots.length <= 7
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400',
          )}
        >
          {quality.hotspots.length} hotspot{quality.hotspots.length !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return null;
}

// ─── HealthScore (main export) ───────────────────────────────────────────────

interface HealthScoreProps {
  health: RepoHealthCheck;
  onGenerate?: (actionType: HealthActionType) => void;
  onGenerateReport?: () => void;
  className?: string;
}

export function HealthScore({ health, onGenerate, onGenerateReport, className }: HealthScoreProps) {
  const {
    score = 0,
    passedCount = 0,
    failedCount = 0,
    criticalCount = 0,
    warningCount = 0,
    notMeasuredCount = 0,
    details = [],
    summary,
  } = health || {};
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  const allPassed = failedCount === 0 && warningCount === 0;

  const structuralChecks = useMemo(
    () => details.filter((d) => d.category === 'structural'),
    [details],
  );
  const qualityChecks = useMemo(() => details.filter((d) => d.category === 'quality'), [details]);

  return (
    <div className={cn('space-y-5', className)}>
      {/* Score header */}
      <div
        className={cn('rounded-xl border p-5', getScoreBorderColor(score), getScoreBgColor(score))}
      >
        <div className="flex items-start gap-6">
          {/* Score ring */}
          <div className="relative shrink-0">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                className="stroke-muted/50"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={cn('transition-all duration-700', getScoreRingColor(score))}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-3xl font-bold tabular-nums', getScoreColor(score))}>
                {score}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                / 100
              </span>
            </div>
          </div>

          {/* Score info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {allPassed ? (
                <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldCheck className={cn('h-5 w-5', getScoreColor(score))} />
              )}
              <h4 className={cn('text-xl font-bold', getScoreColor(score))}>
                {getScoreLabel(score)}
              </h4>
            </div>

            {/* Summary counts */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{passedCount}</span> passed
                </span>
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{failedCount}</span> failed
                  </span>
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{warningCount}</span> warnings
                  </span>
                </span>
              )}
              {notMeasuredCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{notMeasuredCount}</span> N/A
                  </span>
                </span>
              )}
              {criticalCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{criticalCount}</span> critical
                  </span>
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {allPassed
                ? 'Your repository follows most engineering best practices. No action required.'
                : score >= 80
                  ? 'This repository follows strong engineering practices with minor gaps.'
                  : score >= 60
                    ? 'This repository has room for improvement in several areas.'
                    : 'Several important practices are missing. Address high-severity items first.'}
            </p>
          </div>
        </div>

        {/* Score Breakdown — category-based with progress bars */}
        {summary && <ScoreBreakdown summary={summary} />}

        {/* Generate Report button */}
        {onGenerateReport && (
          <div className="mt-4 border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={onGenerateReport}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Generate Report
            </button>
          </div>
        )}
      </div>

      {/* Health check cards */}
      {allPassed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h4 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
            All Checks Passed
          </h4>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
            Your repository passes all {passedCount} health checks. Great work!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Structural checks */}
          {structuralChecks.length > 0 && (
            <div>
              <h5 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileCode className="h-4 w-4" />
                Structural Checks
              </h5>
              <div className="space-y-2">
                {structuralChecks.map((detail) => (
                  <HealthCard key={detail.id} detail={detail} onGenerate={onGenerate} />
                ))}
              </div>
            </div>
          )}

          {/* Quality checks */}
          {qualityChecks.length > 0 && (
            <div>
              <h5 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Target className="h-4 w-4" />
                Quality Checks
              </h5>
              <div className="space-y-2">
                {qualityChecks.map((detail) => (
                  <HealthCard key={detail.id} detail={detail} onGenerate={onGenerate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How is this calculated? */}
      <div className="rounded-xl border border-border/50 bg-background/50 p-4">
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            How is this calculated?
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Score Formula</p>
              <p className="mt-1 font-mono text-[11px]">
                finalScore = round(structuralScore × 0.4 + qualityScore × 0.6)
              </p>
              <p className="mt-1">
                Each check contributes a penalty (0-30 points). The score starts at 100 and
                penalties are deducted proportionally based on maximum possible penalties.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-medium text-foreground">Structural (40% weight)</p>
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  <li>• README — up to -20</li>
                  <li>• License — up to -10</li>
                  <li>• Package Config — up to -10</li>
                  <li>• Gitignore — up to -5</li>
                  <li>• .env.example — up to -5</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Quality (60% weight)</p>
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  <li>• Test Coverage — up to -30</li>
                  <li>• CI/CD Pipeline — up to -30</li>
                  <li>• Security — up to -20</li>
                  <li>• Code Complexity — up to -20</li>
                  <li>• Tech Debt — up to -20</li>
                  <li>• Dependencies — up to -15</li>
                  <li>• README Quality — up to -25</li>
                  <li>• Hotspots — up to -15</li>
                  <li>• Documentation — up to -10</li>
                </ul>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Statuses <code>not_applicable</code> and <code>not_measured</code> do not reduce your
              score.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
