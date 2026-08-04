import { useState, useCallback, useEffect } from 'react';
import { X, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { repoOverviewApi, GENERATOR_LABELS } from '@/lib/repo-overview';
import type { GenerationResult, GenerationError, HealthActionType } from '@/lib/repo-overview';
import { GenerationProgress } from './GenerationProgress';
import { ArtifactPreview } from './ArtifactPreview';
import { ExplanationCard } from './ExplanationCard';

interface GenerationModalProps {
  open: boolean;
  onClose: () => void;
  owner: string;
  repo: string;
  actionType: HealthActionType;
  currentBranch: string;
}

const GENERATION_STEPS = [
  { label: 'Reading repository context', duration: 800 },
  { label: 'Analyzing project structure', duration: 1000 },
  { label: 'Generating AI content', duration: 1500 },
  { label: 'Building artifact', duration: 500 },
];

export function GenerationModal({
  open,
  onClose,
  owner,
  repo,
  actionType,
  currentBranch,
}: GenerationModalProps) {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [view, setView] = useState<'progress' | 'result' | 'error'>('progress');
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<GenerationError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const label = GENERATOR_LABELS[actionType];

  const generate = useCallback(async () => {
    setView('progress');
    setCurrentStep(0);
    setResult(null);
    setError(null);

    try {
      // Simulate progress steps
      const stepPromises = GENERATION_STEPS.map(
        (step, i) =>
          new Promise<void>((resolve) => {
            setTimeout(
              () => {
                setCurrentStep(i);
                resolve();
              },
              step.duration * (i + 1),
            );
          }),
      );

      const generationPromise = repoOverviewApi.generate(owner, repo, actionType, token);

      // Wait for both the generation and the minimum progress time
      const [response] = await Promise.all([generationPromise, Promise.all(stepPromises)]);

      if (response.success && response.data) {
        const data = response.data;
        setCurrentStep(GENERATION_STEPS.length);
        setTimeout(() => {
          setResult(data);
          setView('result');
        }, 400);
      } else {
        setError(response.error || { code: 'UNKNOWN', message: 'Generation failed' });
        setView('error');
      }
    } catch (err) {
      setError({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
      });
      setView('error');
    }
  }, [owner, repo, actionType, token]);

  // Auto-start generation when modal opens
  useEffect(() => {
    if (open && actionType !== 'none') {
      generate();
    }
  }, [open, actionType, generate]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    generate().finally(() => setIsRetrying(false));
  }, [generate]);

  const handleClose = useCallback(() => {
    setView('progress');
    setCurrentStep(0);
    setResult(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (actionType === 'none') return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">{label}</SheetTitle>
                <SheetDescription className="mt-0.5 text-xs">
                  {owner}/{repo} · {currentBranch}
                </SheetDescription>
              </div>
            </div>
            <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === 'progress' && (
            <div className="space-y-6">
              <GenerationProgress
                steps={GENERATION_STEPS.map((s) => ({ label: s.label, duration: s.duration }))}
                currentStep={currentStep}
              />
              <p className="text-center text-xs text-muted-foreground">
                Reading repository structure from {currentBranch} branch...
              </p>
            </div>
          )}

          {view === 'result' && result && (
            <div className="space-y-6">
              <ExplanationCard explanation={result.explanation} fileName={result.fileName} />
              <ArtifactPreview
                content={result.content}
                fileName={result.fileName}
                language={result.language}
                filePath={result.filePath}
              />
            </div>
          )}

          {view === 'error' && error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Generation failed</h3>
              <p className="mt-2 max-w-sm text-xs text-muted-foreground">{error.message}</p>
              <div className="mt-2 rounded-md bg-muted/50 px-3 py-1.5">
                <code className="text-[10px] text-muted-foreground">{error.code}</code>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-6"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                {isRetrying ? 'Retrying...' : 'Try again'}
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border/50 px-6 py-4">
          {view === 'result' && (
            <>
              <SheetClose asChild>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  Back to health audit
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button size="sm">Done</Button>
              </SheetClose>
            </>
          )}
          {view === 'error' && (
            <SheetClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </SheetClose>
          )}
          {view === 'progress' && (
            <SheetClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
