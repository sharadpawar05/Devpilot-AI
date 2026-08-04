import { cn } from '@/lib/utils';
import { extractScore, getScoreColor, getScoreLabel, getScoreBg } from '@/lib/markdown';

interface ScoreBadgeProps {
  text: string;
  className?: string;
  showLabel?: boolean;
}

export function ScoreBadge({ text, className, showLabel = true }: ScoreBadgeProps) {
  const score = extractScore(text);
  if (score === null) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border p-2',
        getScoreBg(score),
        className,
      )}
    >
      <span className={cn('text-2xl font-bold', getScoreColor(score))}>{score}/10</span>
      {showLabel && (
        <span className={cn('text-sm font-medium', getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}

interface ScoreDisplayProps {
  score: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreDisplay({ score, className, size = 'md' }: ScoreDisplayProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'font-bold',
          getScoreColor(score),
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-lg',
          size === 'lg' && 'text-3xl',
        )}
      >
        {score}/10
      </span>
      {size !== 'sm' && (
        <span className={cn('text-sm font-medium', getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}
