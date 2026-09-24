import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RepositoryCard } from './RepositoryCard';
import type { GitHubRepo } from '@/hooks/use-github';

export interface RepositoryGridProps {
  repositories: GitHubRepo[];
  selectedRepo?: string;
  onSelect?: (fullName: string) => void;
  loading?: boolean;
  skeletonCount?: number;
  limit?: number;
  className?: string;
  emptyMessage?: string;
}

export function RepositoryGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      data-testid="repository-grid-skeleton"
      aria-busy="true"
      aria-label="Loading repositories"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[112px] rounded-xl border border-input bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RepositoryGrid({
  repositories,
  selectedRepo,
  onSelect,
  loading,
  skeletonCount = 6,
  limit,
  className,
  emptyMessage = 'No repositories found.',
}: RepositoryGridProps) {
  if (loading) {
    return <RepositoryGridSkeleton count={skeletonCount} className={className} />;
  }

  const visible = limit != null ? repositories.slice(0, limit) : repositories;

  if (visible.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground',
          className,
        )}
        data-testid="repository-grid-empty"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      data-testid="repository-grid"
      role="list"
      aria-label="Repositories"
    >
      {visible.map((repo) => (
        <div key={repo.full_name} role="listitem">
          <RepositoryCard
            repo={repo}
            selected={selectedRepo === repo.full_name}
            onSelect={onSelect}
            className="h-full"
          />
        </div>
      ))}
    </div>
  );
}
