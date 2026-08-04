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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RepoHealthCheck,
  RepoHealthDetail,
  HealthSeverity,
  HealthActionType,
  ScoreBreakdownItem,
} from '@/lib/repo-overview';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
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
        <SeverityBadge severity={detail.severity} />
        <span className="ml-auto font-mono text-xs font-medium text-red-600 dark:text-red-400">
          -{detail.scorePenalty}
        </span>
      </div>
      <ExpandableRecommendation detail={detail} onGenerate={onGenerate} />
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
  const { score, passedCount, failedCount, criticalCount, details, scoreBreakdown } = health;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  const sortedDetails = useMemo(() => {
    return [...details].sort((a, b) => {
      if (a.passed && !b.passed) return 1;
      if (!a.passed && b.passed) return -1;
      if (!a.passed && !b.passed) {
        return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      }
      return 0;
    });
  }, [details]);

  const allPassed = failedCount === 0;

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
        <div className="space-y-2">
          {sortedDetails.map((detail) => (
            <HealthCard key={detail.name} detail={detail} onGenerate={onGenerate} />
          ))}
        </div>
      )}
    </div>
  );
}
