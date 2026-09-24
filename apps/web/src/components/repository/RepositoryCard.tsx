import { memo } from 'react';
import {
  MessageSquare,
  Code,
  BarChart3,
  Star,
  GitFork,
  HardDrive,
  Lock,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRepoSize, formatStars, languageColor } from '@/lib/repo-card-utils';
import type { GitHubRepo } from '@/hooks/use-github';

export interface RepositoryCardActions {
  onChat?: (fullName: string) => void;
  onReview?: (fullName: string) => void;
  onAnalyze?: (fullName: string) => void;
}

interface RepositoryCardProps extends RepositoryCardActions {
  repo: GitHubRepo;
  selected?: boolean;
  onSelect?: (fullName: string) => void;
  className?: string;
}

export const RepositoryCard = memo(function RepositoryCard({
  repo,
  selected,
  onSelect,
  onChat,
  onReview,
  onAnalyze,
  className,
}: RepositoryCardProps) {
  const handleSelect = () => onSelect?.(repo.full_name);

  return (
    <article
      data-testid="repository-card"
      data-repo={repo.full_name}
      className={cn(
        'repo-card group relative flex h-full flex-col rounded-xl border border-input bg-card p-4 shadow-sm',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderGit2 className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelect}
              className="min-w-0 truncate rounded-sm text-left text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={repo.full_name}
            >
              {repo.name}
            </button>
            {repo.private && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                private
              </span>
            )}
          </div>

          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {repo.description || 'No description'}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5" title={repo.language ?? 'No language'}>
          <span
            className={cn('h-2.5 w-2.5 rounded-full', languageColor(repo.language))}
            aria-hidden
          />
          {repo.language || 'Unknown'}
        </span>
        <span className="inline-flex items-center gap-1" title="Stars">
          <Star className="h-3.5 w-3.5" aria-hidden />
          {formatStars(repo.stargazers_count)}
        </span>
        {typeof repo.forks_count === 'number' && (
          <span className="inline-flex items-center gap-1" title="Forks">
            <GitFork className="h-3.5 w-3.5" aria-hidden />
            {formatStars(repo.forks_count)}
          </span>
        )}
        <span className="inline-flex items-center gap-1" title="Repository size">
          <HardDrive className="h-3.5 w-3.5" aria-hidden />
          {formatRepoSize(repo.size)}
        </span>
      </div>

      {/* Quick actions — revealed on hover / focus */}
      <div
        className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        data-testid="repo-quick-actions"
      >
        <QuickAction icon={MessageSquare} label="Chat" onClick={() => onChat?.(repo.full_name)} />
        <QuickAction icon={Code} label="Review" onClick={() => onReview?.(repo.full_name)} />
        <QuickAction icon={BarChart3} label="Analyze" onClick={() => onAnalyze?.(repo.full_name)} />
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Open on GitHub"
          aria-label={`Open ${repo.full_name} on GitHub`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
});

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MessageSquare;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95"
      aria-label={`${label} repository`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
