import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

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
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="flex gap-2">
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
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-40" />
      </div>
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
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ paddingLeft: `${(i % 3) * 16}px` }}
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="h-28 w-28 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <OverviewHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <SummarySkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TreeSkeleton />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <LanguageSkeleton />
          <HealthSkeleton />
        </div>
      </div>
    </div>
  );
}

export function LoadingProgress({ steps }: { steps: string[] }) {
  const currentStep = steps.length - 1;

  return (
    <div className="rounded-lg border bg-card p-8">
      <div className="flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full bg-primary/20" />
          </div>
        </div>
        <div className="w-full max-w-xs space-y-2">
          {steps.map((step, i) => (
            <div
              key={step}
              className={cn(
                'flex items-center gap-2 text-sm transition-all duration-300',
                i < currentStep && 'text-muted-foreground',
                i === currentStep && 'text-foreground font-medium',
              )}
            >
              {i < currentStep ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10">
                  <svg className="h-2.5 w-2.5 text-emerald-500" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
              <span className="truncate">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
