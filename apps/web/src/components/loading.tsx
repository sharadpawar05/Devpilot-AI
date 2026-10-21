import { Skeleton } from '@/components/ui/skeleton';
import { BrandLogo } from '@/components/brand-logo';

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
      <div className="animate-scale-in">
        <BrandLogo className="h-12 w-12" />
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
