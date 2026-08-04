import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  );
}

export function OverviewHeaderSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-6">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function LanguageSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-6">
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-full rounded" />
      <div className="space-y-1.5 pl-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ paddingLeft: `${(i % 3) * 12}px` }}
          >
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className={`h-3.5 w-${20 + (i % 4) * 8}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <Skeleton className="h-6 w-32" />
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function LoadingProgress({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <div className="space-y-2 text-center">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2 text-sm">
            {i < steps.length - 1 ? (
              <span className="text-emerald-500">✓</span>
            ) : (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            )}
            <span
              className={
                i < steps.length - 1 ? 'text-muted-foreground' : 'text-foreground font-medium'
              }
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
