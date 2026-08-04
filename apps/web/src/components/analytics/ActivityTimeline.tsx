import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  GitPullRequest,
  FileCode,
  Play,
  Folder,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { ActivityTimelineItem } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  data: ActivityTimelineItem[];
}

const typeConfig: Record<string, { icon: typeof MessageSquare; color: string; label: string }> = {
  'repo-chat': { icon: MessageSquare, color: 'bg-emerald-500', label: 'Repository Chat' },
  'pr-review': { icon: GitPullRequest, color: 'bg-blue-500', label: 'PR Review' },
  'code-review': { icon: FileCode, color: 'bg-purple-500', label: 'Code Review' },
  playground: { icon: Play, color: 'bg-pink-500', label: 'Playground' },
  'repo-analysis': { icon: Folder, color: 'bg-amber-500', label: 'Repository Analysis' },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const ActivityTimeline = memo(function ActivityTimeline({ data }: ActivityTimelineProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (item: ActivityTimelineItem) => {
      const routes: Record<string, string> = {
        'repo-chat': '/repository-chat',
        'pr-review': '/pull-request-assistant',
        'code-review': '/code-review',
        playground: '/playground',
        'repo-analysis': '/repository-overview',
      };
      navigate(routes[item.type] || '/dashboard');
    },
    [navigate],
  );

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
      <div className="relative space-y-3">
        <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-px bg-border" />
        {data.map((item) => {
          const config = typeConfig[item.type] || typeConfig['code-review'];
          const Icon = config.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className="group relative flex w-full items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-muted/30"
            >
              <div
                className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  config.color,
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{config.label}</span>
                  {item.repository && (
                    <>
                      <span>·</span>
                      <span className="truncate">{item.repository}</span>
                    </>
                  )}
                  {item.model && (
                    <>
                      <span>·</span>
                      <span>{item.model}</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
});
