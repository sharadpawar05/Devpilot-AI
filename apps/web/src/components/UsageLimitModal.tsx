import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, CalendarClock, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { UsageLimitDetails } from '@/lib/api-error';
import { FEATURE_COPY } from '@/lib/usage-copy';

function formatReset(resetAt?: string): string | null {
  if (!resetAt) return null;
  try {
    const d = new Date(resetAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

export interface UsageLimitModalProps {
  details: UsageLimitDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UsageLimitModal = memo(function UsageLimitModal({
  details,
  open,
  onOpenChange,
}: UsageLimitModalProps) {
  const navigate = useNavigate();

  if (!details) return null;

  const copy = FEATURE_COPY[details.feature] ?? FEATURE_COPY.AI_REPORT;
  const resetLabel = formatReset(details.resetAt);
  const used = details.used;
  const limit = details.limit;
  const hasUsageNumbers = limit > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          </div>
          <AlertDialogTitle className="text-left">{copy.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>{details.message || copy.unit(limit)}</p>
              <p className="text-xs text-muted-foreground">{copy.blurb}</p>

              {hasUsageNumbers && (
                <div className="rounded-lg border border-input bg-muted/40 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                      Usage
                    </span>
                    <span className="font-semibold text-foreground">
                      {used} / {limit}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={used}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(limit, used)}
                    aria-label={`${copy.title} usage`}
                  >
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{
                        width: `${Math.min((used / limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {resetLabel && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  Resets {resetLabel}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Upgrade your plan to continue, or wait until your usage resets.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>Got it</AlertDialogAction>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              navigate('/settings');
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Upgrade plan
          </AlertDialogAction>
        </AlertDialogFooter>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDialogContent>
    </AlertDialog>
  );
});
