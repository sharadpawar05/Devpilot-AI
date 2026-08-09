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
  GitBranch,
  Lock,
  Package,
  Bug,
  Layers,
  FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RepoHealthCheck,
  RepoHealthDetail,
  HealthSeverity,
  HealthCheckCategory,
  HealthActionType,
  ScoreBreakdownItem,
} from '@/lib/repo-overview';

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── ScoreBreakdown ──────────────────────────────────────────────────────────

function ScoreBreakdown({ breakdown }: { breakdown: ScoreBreakdownItem[] }) {
  if (breakdown.length === 0) return null;

  const totalPenalty = breakdown.reduce((sum, b) => sum + b.penalty, 0);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" />
        <span>Score Breakdown</span>
        <span className="ml-auto font-mono text-red-600 dark:text-red-400">
          -{totalPenalty} total
        </span>
      </div>
      <div className="space-y-1">
        {breakdown.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-md bg-background/80 px-3 py-1.5 text-xs"
          >
            <span className="text-muted-foreground">
              Missing <span className="font-medium text-foreground">{item.name}</span>
            </span>
            <span className="font-mono font-medium text-red-600 dark:text-red-400">
              -{item.penalty}
            </span>
          </div>
        ))}
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

// ─── HealthCard ──────────────────────────────────────────────────────────────

function HealthCard({
  detail,
  onGenerate,
}: {
  detail: RepoHealthDetail;
  onGenerate?: (actionType: HealthActionType) => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[detail.category];

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

// ─── CategoryScore ───────────────────────────────────────────────────────────

function CategoryScore({
  label,
  score,
  weight,
  icon: Icon,
  color,
}: {
  label: string;
  score: number;
  weight: number;
  icon: typeof Target;
  color: 'blue' | 'purple' | 'emerald' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2">
      <Icon className={cn('h-4 w-4', colorClasses[color])} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">({weight}%)</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-500', colorClasses[color])}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn('text-xs font-semibold', colorClasses[color])}>{score}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── MetricBadge ─────────────────────────────────────────────────────────────

function MetricBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'red' | 'blue';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        colorClasses[color],
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ─── HealthScore (main export) ───────────────────────────────────────────────

interface HealthScoreProps {
  health: RepoHealthCheck;
  onGenerate?: (actionType: HealthActionType) => void;
  className?: string;
}

export function HealthScore({ health, onGenerate, className }: HealthScoreProps) {
  const {
    score = 0,
    passedCount = 0,
    failedCount = 0,
    criticalCount = 0,
    details = [],
    scoreBreakdown = [],
    summary,
  } = health || {};
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  const allPassed = failedCount === 0;

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

            {/* Score breakdown */}
            <ScoreBreakdown breakdown={scoreBreakdown} />
          </div>
        </div>

        {/* Category breakdown */}
        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
            <CategoryScore
              label="Structural"
              score={summary.structuralScore}
              weight={summary.structuralWeight}
              icon={FileCode}
              color="blue"
            />
            <CategoryScore
              label="Quality"
              score={summary.qualityScore}
              weight={summary.qualityWeight}
              icon={Target}
              color="purple"
            />
          </div>
        )}

        {/* Quality metrics summary */}
        {summary && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-border/50 pt-4">
            {summary.testCoverage !== undefined && (
              <MetricBadge
                icon={Target}
                label="Test Coverage"
                value={`${summary.testCoverage}%`}
                color={
                  summary.testCoverage >= 80
                    ? 'emerald'
                    : summary.testCoverage >= 60
                      ? 'amber'
                      : 'red'
                }
              />
            )}
            {summary.documentationScore !== undefined && (
              <MetricBadge
                icon={FileCode}
                label="Documentation"
                value={`${summary.documentationScore}%`}
                color={
                  summary.documentationScore >= 80
                    ? 'emerald'
                    : summary.documentationScore >= 60
                      ? 'amber'
                      : 'red'
                }
              />
            )}
            {summary.cicdScore !== undefined && (
              <MetricBadge
                icon={GitBranch}
                label="CI/CD"
                value={`${summary.cicdScore}%`}
                color={
                  summary.cicdScore >= 80 ? 'emerald' : summary.cicdScore >= 60 ? 'amber' : 'red'
                }
              />
            )}
            {summary.securityScore !== undefined && (
              <MetricBadge
                icon={Lock}
                label="Security"
                value={`${summary.securityScore}%`}
                color={
                  summary.securityScore >= 80
                    ? 'emerald'
                    : summary.securityScore >= 60
                      ? 'amber'
                      : 'red'
                }
              />
            )}
            {summary.dependencyScore !== undefined && (
              <MetricBadge
                icon={Package}
                label="Dependencies"
                value={`${summary.dependencyScore}%`}
                color={
                  summary.dependencyScore >= 80
                    ? 'emerald'
                    : summary.dependencyScore >= 60
                      ? 'amber'
                      : 'red'
                }
              />
            )}
            {summary.complexityScore !== undefined && (
              <MetricBadge
                icon={Layers}
                label="Complexity"
                value={`${summary.complexityScore}/100`}
                color={
                  summary.complexityScore >= 70
                    ? 'emerald'
                    : summary.complexityScore >= 40
                      ? 'amber'
                      : 'red'
                }
              />
            )}
            {summary.debtScore !== undefined && (
              <MetricBadge
                icon={FileWarning}
                label="Debt"
                value={`${summary.debtScore}/100`}
                color={
                  summary.debtScore >= 70 ? 'emerald' : summary.debtScore >= 40 ? 'amber' : 'red'
                }
              />
            )}
            {summary.hotspotCount !== undefined && summary.hotspotCount > 0 && (
              <MetricBadge
                icon={Bug}
                label="Hotspots"
                value={`${summary.hotspotCount}`}
                color={
                  summary.hotspotCount <= 3
                    ? 'emerald'
                    : summary.hotspotCount <= 7
                      ? 'amber'
                      : 'red'
                }
              />
            )}
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
                  <HealthCard key={detail.name} detail={detail} onGenerate={onGenerate} />
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
                  <HealthCard key={detail.name} detail={detail} onGenerate={onGenerate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
