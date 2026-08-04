import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function HistoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-input bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function HistoryPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <HistoryCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
