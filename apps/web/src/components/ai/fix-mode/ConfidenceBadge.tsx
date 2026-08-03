import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

function getConfidenceStyle(score: number) {
  if (score >= 0.8) return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
  if (score >= 0.5)
    return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
  return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
}

function getConfidenceLabel(score: number) {
  if (score >= 0.8) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getConfidenceStyle(score),
        className,
      )}
    >
      {getConfidenceLabel(score)} ({percentage}%)
    </span>
  );
}
