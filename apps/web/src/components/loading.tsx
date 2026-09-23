import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 p-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-scale-in">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <LoadingSpinner />
      <p className="text-sm text-muted-foreground">Loading DevPilot…</p>
      <div className="mt-4 w-full max-w-sm space-y-3" aria-hidden>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <span className="sr-only">Loading DevPilot</span>
    </div>
  );
}
