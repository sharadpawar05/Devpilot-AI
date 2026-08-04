import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  GitPullRequest,
  FileCode,
  Play,
  BookOpen,
  FlaskConical,
  Shield,
  Layout,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { AIHistorySessionMetadata, WorkflowType } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  data: AIHistorySessionMetadata[];
}

const typeConfig: Record<WorkflowType, { icon: typeof MessageSquare; color: string }> = {
  playground: { icon: Play, color: 'bg-pink-500' },
  'code-review': { icon: FileCode, color: 'bg-purple-500' },
  'pr-review': { icon: GitPullRequest, color: 'bg-blue-500' },
  'pr-analysis': { icon: GitPullRequest, color: 'bg-blue-500' },
  'repository-chat': { icon: MessageSquare, color: 'bg-emerald-500' },
  documentation: { icon: BookOpen, color: 'bg-orange-500' },
  'test-generation': { icon: FlaskConical, color: 'bg-amber-500' },
  'security-review': { icon: Shield, color: 'bg-red-500' },
  'architecture-review': { icon: Layout, color: 'bg-indigo-500' },
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
    (session: AIHistorySessionMetadata) => {
      navigate(`/history?session=${session.id}`);
    },
    [navigate],
  );

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start using AI features to see your activity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
      <div className="relative space-y-3">
        <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-px bg-border" />
        {data.map((session) => {
          const config = typeConfig[session.workflowType] || typeConfig.playground;
          const Icon = config.icon;
          return (
            <button
              key={session.id}
              onClick={() => handleClick(session)}
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
                  {session.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{WORKFLOW_TYPE_LABELS[session.workflowType]}</span>
                  {session.repository && (
                    <>
                      <span>·</span>
                      <span className="truncate">{session.repository}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{session.provider}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(session.updatedAt)}
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
