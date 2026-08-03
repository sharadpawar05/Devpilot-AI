import { useNavigate } from 'react-router-dom';
import {
  History,
  ArrowRight,
  MessageSquare,
  FileCode,
  GitPullRequest,
  BookOpen,
  FlaskConical,
  Folder,
  Loader2,
} from 'lucide-react';
import type { WorkflowType } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { useRecentHistory } from '@/hooks/use-history';

const workflowIcons: Record<WorkflowType, typeof MessageSquare> = {
  playground: MessageSquare,
  'code-review': FileCode,
  'pr-review': GitPullRequest,
  'pr-analysis': GitPullRequest,
  'repository-chat': Folder,
  documentation: BookOpen,
  'test-generation': FlaskConical,
  'security-review': Folder,
  'architecture-review': Folder,
};

export function DashboardHistoryWidget() {
  const navigate = useNavigate();
  const { sessions, isLoading } = useRecentHistory(5);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recent Activity</h3>
        </div>
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <History className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start using AI features to see your history here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const Icon = workflowIcons[session.workflowType] || MessageSquare;
            return (
              <button
                key={session.id}
                onClick={() => navigate(`/history?session=${session.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{WORKFLOW_TYPE_LABELS[session.workflowType]}</span>
                    <span>·</span>
                    <span>{formatDate(session.updatedAt)}</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DashboardHistorySkeleton() {
  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-input p-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
