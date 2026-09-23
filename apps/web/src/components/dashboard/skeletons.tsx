import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />;
}

export function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-1" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-1" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-input bg-card p-4 shadow-sm"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

export function GitHubWidgetSkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="mb-3 h-14 rounded-xl" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

export function UsageAnalyticsSkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-3 w-16" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/50 px-3 py-3">
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div>
          <Skeleton className="mb-2 h-3 w-12" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/50 px-3 py-3">
                <Skeleton className="mb-2 h-3 w-14" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="relative space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceStatusSkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TipsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function DashboardFullSkeleton() {
  return (
    <div className="w-full space-y-6 p-6">
      <HeroSkeleton />
      <QuickActionsSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <GitHubWidgetSkeleton />
          <UsageAnalyticsSkeleton />
        </div>
        <div className="space-y-6">
          <RecentActivitySkeleton />
          <WorkspaceStatusSkeleton />
          <TipsCardSkeleton />
        </div>
      </div>
    </div>
  );
}
