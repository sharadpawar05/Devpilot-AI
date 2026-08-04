import { cn } from '@/lib/utils';
import type { RepoContributor } from '@/lib/repo-overview';

interface ContributorListProps {
  contributors: RepoContributor[];
  maxDisplay?: number;
  className?: string;
}

export function ContributorList({ contributors, maxDisplay = 8, className }: ContributorListProps) {
  const displayed = contributors.slice(0, maxDisplay);
  const remaining = contributors.length - maxDisplay;

  if (displayed.length === 0) return null;

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-2">
        {displayed.map((c) => (
          <a
            key={c.login}
            href={c.html_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${c.login} (${c.contributions} contributions)`}
            className="relative inline-block"
          >
            <img
              src={c.avatar_url}
              alt={c.login}
              className="h-8 w-8 rounded-full border-2 border-background transition-transform hover:scale-110 hover:z-10"
              loading="lazy"
            />
          </a>
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">+{remaining} more</span>
      )}
    </div>
  );
}
