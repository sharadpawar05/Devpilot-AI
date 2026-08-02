import { useState, useEffect } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RepositoryIndexingStateProps {
  repoFullName: string;
  onCancel: () => void;
}

const steps = [
  'Connecting to repository...',
  'Reading repository structure...',
  'Building project map...',
  'Preparing AI context...',
];

export function RepositoryIndexingState({ repoFullName, onCancel }: RepositoryIndexingStateProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) return prev;
        return prev + 1;
      });
    }, 2500);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + 1;
      });
    }, 300);

    return () => {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>

        <h2 className="text-xl font-bold tracking-tight">Indexing Repository</h2>
        <p className="mt-2 text-sm text-muted-foreground">{repoFullName}</p>

        <div className="mt-8 text-left">
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mb-6 text-center text-xs text-muted-foreground">
            {Math.round(progress)}% complete
          </p>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                {i < currentStep ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : i === currentStep ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border border-input" />
                )}
                <span
                  className={`text-sm ${
                    i <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" className="mt-8" onClick={onCancel}>
          <X className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
