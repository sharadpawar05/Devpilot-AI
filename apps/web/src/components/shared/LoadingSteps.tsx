import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  duration?: number;
}

interface LoadingStepsProps {
  steps: Step[];
  className?: string;
  showProgress?: boolean;
  externalProgress?: number;
}

function LoadingSteps({
  steps,
  className,
  showProgress = true,
  externalProgress,
}: LoadingStepsProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const duration = steps[activeStep]?.duration ?? 2500;
    if (activeStep < steps.length - 1) {
      timeout = setTimeout(() => setActiveStep((s) => s + 1), duration);
    }
    return () => clearTimeout(timeout);
  }, [activeStep, steps]);

  const progress = externalProgress ?? Math.round(((activeStep + 1) / steps.length) * 100);

  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <div className="w-full max-w-xs space-y-3">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300',
                i < activeStep
                  ? 'bg-primary/20 text-primary'
                  : i === activeStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {i < activeStep ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-xs transition-colors duration-300',
                i <= activeStep ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {i === activeStep && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
          </div>
        ))}
        {showProgress && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
  variant?: 'text' | 'heading' | 'avatar' | 'card';
}

function LoadingSkeleton({ lines = 3, className, variant = 'text' }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('space-y-3 rounded-lg border border-border bg-card p-4', className)}>
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-muted"
              style={{ width: `${85 - i * 10}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-2 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (variant === 'heading') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-muted"
          style={{ width: `${90 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

const PLAYGROUND_LOADING_STEPS: Step[] = [
  { label: 'Connecting to AI provider...', duration: 1500 },
  { label: 'Processing prompt...', duration: 2000 },
  { label: 'Generating response...', duration: 2500 },
  { label: 'Formatting output...', duration: 1500 },
];

const CODE_REVIEW_LOADING_STEPS: Step[] = [
  { label: 'Parsing code structure', duration: 2000 },
  { label: 'Checking correctness', duration: 3000 },
  { label: 'Reviewing performance', duration: 3000 },
  { label: 'Scanning for security issues', duration: 2500 },
  { label: 'Generating recommendations', duration: 2500 },
];

const PR_LOADING_STEPS: Step[] = [
  { label: 'Loading Pull Request...', duration: 2000 },
  { label: 'Analyzing files...', duration: 3000 },
  { label: 'Generating review...', duration: 3000 },
  { label: 'Preparing documentation...', duration: 2000 },
  { label: 'Building checklists...', duration: 2000 },
];

const REPO_CHAT_LOADING_STEPS: Step[] = [
  { label: 'Connecting to repository...', duration: 1500 },
  { label: 'Indexing file structure...', duration: 3000 },
  { label: 'Building search index...', duration: 2500 },
  { label: 'Ready to chat!', duration: 1000 },
];

function PlaygroundLoadingSteps({ className }: { className?: string }) {
  return <LoadingSteps steps={PLAYGROUND_LOADING_STEPS} className={className} />;
}

function CodeReviewLoadingSteps({ className }: { className?: string }) {
  return <LoadingSteps steps={CODE_REVIEW_LOADING_STEPS} className={className} />;
}

function PRLoadingSteps({
  className,
  isLoading = true,
}: {
  className?: string;
  isLoading?: boolean;
}) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!isLoading) {
      setActiveStep(PR_LOADING_STEPS.length - 1);
      return;
    }
    const duration = PR_LOADING_STEPS[activeStep]?.duration ?? 2500;
    if (activeStep < PR_LOADING_STEPS.length - 1) {
      timeout = setTimeout(() => setActiveStep((s) => s + 1), duration);
    }
    return () => clearTimeout(timeout);
  }, [activeStep, isLoading]);

  const stepProgress = Math.round(((activeStep + 1) / PR_LOADING_STEPS.length) * 100);
  const progress = isLoading ? Math.min(stepProgress, 99) : 100;

  return (
    <LoadingSteps steps={PR_LOADING_STEPS} className={className} externalProgress={progress} />
  );
}

function RepoChatLoadingSteps({ className }: { className?: string }) {
  return <LoadingSteps steps={REPO_CHAT_LOADING_STEPS} className={className} />;
}

export {
  LoadingSteps,
  LoadingSkeleton,
  PlaygroundLoadingSteps,
  CodeReviewLoadingSteps,
  PRLoadingSteps,
  RepoChatLoadingSteps,
};
export type { Step, LoadingStepsProps, LoadingSkeletonProps };
