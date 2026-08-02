import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from './sidebar-provider';
import type { GitHubContextValue } from '@/hooks/use-github';

interface SidebarFooterProps {
  gh: GitHubContextValue;
}

export function SidebarFooter({ gh }: SidebarFooterProps) {
  const { collapsed, isMobile } = useSidebar();

  if (collapsed && !isMobile) {
    if (gh.connected && gh.githubUser) {
      return (
        <div className="flex flex-col items-center gap-2 p-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/github" className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={gh.githubUser.avatar_url} alt={gh.githubUser.login} />
                  <AvatarFallback>{gh.githubUser.login[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="font-medium">@{gh.githubUser.login}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 p-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to="/github"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Github className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Connect GitHub
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <Separator />
      {gh.connected && gh.githubUser ? (
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={gh.githubUser.avatar_url} alt={gh.githubUser.login} />
                <AvatarFallback>{gh.githubUser.login[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{gh.githubUser.login}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </div>
            <Link
              to="/github"
              className={cn(
                'flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
            >
              Manage
            </Link>
          </div>
        </div>
      ) : (
        <Link
          to="/github"
          className="flex items-center gap-2.5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Github className="h-4 w-4 shrink-0" />
          <span>Connect GitHub</span>
        </Link>
      )}
    </div>
  );
}
