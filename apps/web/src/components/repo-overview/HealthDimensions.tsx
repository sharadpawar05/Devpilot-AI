import {
  FileCode,
  Target,
  Lock,
  Package,
  Layers,
  Shield,
  GitBranch,
  BookOpen,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RepositoryHealthSummary } from '@/lib/repo-overview';

interface Dimension {
  key: string;
  label: string;
  icon: typeof FileCode;
  scoreKey: keyof RepositoryHealthSummary;
  color: string;
  bgColor: string;
  description: string;
}

const DIMENSIONS: Dimension[] = [
  {
    key: 'structural',
    label: 'Structural',
    icon: FileCode,
    scoreKey: 'structuralScore',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    description: 'Essential project files',
  },
  {
    key: 'quality',
    label: 'Quality',
    icon: Target,
    scoreKey: 'qualityScore',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    description: 'Code quality practices',
  },
  {
    key: 'security',
    label: 'Security',
    icon: Lock,
    scoreKey: 'securityScore',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    description: 'Vulnerability protection',
  },
  {
    key: 'dependencies',
    label: 'Dependencies',
    icon: Package,
    scoreKey: 'dependencyScore',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    description: 'Package health',
  },
  {
    key: 'maintainability',
    label: 'Maintainability',
    icon: Layers,
    scoreKey: 'maintainabilityScore',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    description: 'Long-term code health',
  },
  {
    key: 'cicd',
    label: 'CI/CD',
    icon: GitBranch,
    scoreKey: 'cicdScore',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/40',
    description: 'Automation pipeline',
  },
  {
    key: 'documentation',
    label: 'Documentation',
    icon: BookOpen,
    scoreKey: 'documentationScore',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/40',
    description: 'Project documentation',
  },
  {
    key: 'testCoverage',
    label: 'Test Coverage',
    icon: Shield,
    scoreKey: 'testCoverage',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/40',
    description: 'Test coverage percentage',
  },
  {
    key: 'complexity',
    label: 'Complexity',
    icon: Gauge,
    scoreKey: 'complexityScore',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/40',
    description: 'Code complexity level',
  },
];

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

interface DimensionCardProps {
  dimension: Dimension;
  score: number | undefined;
}

function DimensionCard({ dimension, score }: DimensionCardProps) {
  const { label, icon: Icon, color, bgColor, description } = dimension;
  const displayScore = score ?? 0;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-4 transition-colors hover:bg-accent/50">
      <div className="flex items-start gap-3">
        <div
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bgColor)}
        >
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{label}</span>
            {score !== undefined ? (
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold tabular-nums', getScoreColor(displayScore))}>
                  {displayScore}
                </span>
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    strokeWidth="3"
                    className="stroke-muted/50"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className={cn('transition-all duration-500', getScoreRingColor(displayScore))}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface HealthDimensionsProps {
  summary: RepositoryHealthSummary | undefined;
}

export function HealthDimensions({ summary }: HealthDimensionsProps) {
  if (!summary) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Health Dimensions</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DIMENSIONS.map((dimension) => (
          <DimensionCard
            key={dimension.key}
            dimension={dimension}
            score={summary[dimension.scoreKey] as number | undefined}
          />
        ))}
      </div>
    </div>
  );
}
