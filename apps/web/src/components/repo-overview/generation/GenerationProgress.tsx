import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  duration: number;
}

interface GenerationProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function GenerationProgress({ steps, currentStep, className }: GenerationProgressProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isActive = i === currentStep;
        const isPending = i > currentStep;

        return (
          <div
            key={step.label}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
              isActive && 'bg-primary/5',
              isPending && 'opacity-40',
            )}
          >
            {isComplete ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : isActive ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" />
            )}
            <span
              className={cn(
                'flex-1',
                isComplete && 'text-muted-foreground',
                isActive && 'font-medium text-foreground',
                isPending && 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {isComplete && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Done</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
