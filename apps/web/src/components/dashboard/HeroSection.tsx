import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, GitPullRequest, Rocket, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@devpilot/types';
import type { GitHubContextValue } from '@/hooks/use-github';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HeroSectionProps {
  user: AuthUser | null;
  gh: GitHubContextValue;
  aiRequestsToday: number;
  lastActivityAt: string | null;
}

export const HeroSection = memo(function HeroSection({
  user,
  gh,
  aiRequestsToday,
  lastActivityAt,
}: HeroSectionProps) {
  const navigate = useNavigate();

  const firstName = user?.name?.split(' ')[0] || 'Developer';

  const lastActivityLabel = lastActivityAt ? formatRelativeTime(lastActivityAt) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-input bg-card p-6 shadow-sm sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                gh.connected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  gh.connected ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                }`}
              />
              GitHub {gh.connected ? 'Connected' : 'Not Connected'}
            </span>
            {gh.connected && gh.selectedRepoName && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="flex items-center gap-1 truncate">
                  <Code className="h-3.5 w-3.5 shrink-0" />
                  {gh.selectedRepoName}
                </span>
                {gh.selectedBranch && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="truncate">{gh.selectedBranch}</span>
                  </>
                )}
              </>
            )}
            {aiRequestsToday > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  {aiRequestsToday} AI requests today
                </span>
              </>
            )}
            {lastActivityLabel && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span>Last active {lastActivityLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gh.connected ? (
            <Button onClick={() => navigate('/code-review')} className="gap-2">
              <Rocket className="h-4 w-4" />
              Start Code Review
            </Button>
          ) : (
            <Button onClick={() => navigate('/github')} className="gap-2">
              <GitPullRequest className="h-4 w-4" />
              Connect GitHub
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
