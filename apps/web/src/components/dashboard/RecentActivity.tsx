import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileCode,
  GitPullRequest,
  Play,
  MessageSquare,
  BookOpen,
  FlaskConical,
  Shield,
  Layout,
  Zap,
  Clock,
  History,
} from 'lucide-react';
import type { WorkflowType } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { useRecentHistory } from '@/hooks/use-history';

interface ActivityItem {
  id: string;
  action: string;
  resourceType: string;
  label?: string;
  provider?: string;
  model?: string;
  tokens?: number;
  latencyMs?: number;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

const workflowIcons: Record<string, typeof MessageSquare> = {
  playground: Play,
  code_review: FileCode,
  'code-review': FileCode,
  pr_review: GitPullRequest,
  'pr-review': GitPullRequest,
  pr_analysis: GitPullRequest,
  'pr-analysis': GitPullRequest,
  repository_chat: MessageSquare,
  'repository-chat': MessageSquare,
  documentation: BookOpen,
  test_generation: FlaskConical,
  'test-generation': FlaskConical,
  security_review: Shield,
  'security-review': Shield,
  architecture_review: Layout,
  'architecture-review': Layout,
  github_connected: MessageSquare,
  health_scan: Shield,
  'health-scan': Shield,
  dependency_analysis: FlaskConical,
  'dependency-analysis': FlaskConical,
  ai_report: BookOpen,
  'ai-report': BookOpen,
  engineering_status: Layout,
  'engineering-status': Layout,
  repository_overview: Layout,
  'repository-overview': Layout,
};

const workflowColors: Record<string, string> = {
  playground: 'bg-pink-500',
  code_review: 'bg-purple-500',
  'code-review': 'bg-purple-500',
  pr_review: 'bg-blue-500',
  'pr-review': 'bg-blue-500',
  pr_analysis: 'bg-blue-500',
  'pr-analysis': 'bg-blue-500',
  repository_chat: 'bg-emerald-500',
  'repository-chat': 'bg-emerald-500',
  documentation: 'bg-orange-500',
  test_generation: 'bg-amber-500',
  'test-generation': 'bg-amber-500',
  security_review: 'bg-red-500',
  'security-review': 'bg-red-500',
  architecture_review: 'bg-indigo-500',
  'architecture-review': 'bg-indigo-500',
  github_connected: 'bg-emerald-500',
  health_scan: 'bg-teal-500',
  'health-scan': 'bg-teal-500',
  dependency_analysis: 'bg-amber-500',
  'dependency-analysis': 'bg-amber-500',
  ai_report: 'bg-orange-500',
  'ai-report': 'bg-orange-500',
  engineering_status: 'bg-indigo-500',
  'engineering-status': 'bg-indigo-500',
  repository_overview: 'bg-pink-500',
  'repository-overview': 'bg-pink-500',
};

const historyIcons: Record<WorkflowType, typeof MessageSquare> = {
  playground: Play,
  'code-review': FileCode,
  'pr-review': GitPullRequest,
  'pr-analysis': GitPullRequest,
  'repository-chat': MessageSquare,
  documentation: BookOpen,
  'test-generation': FlaskConical,
  'security-review': Shield,
  'architecture-review': Layout,
};

const historyLabels: Partial<Record<string, string>> = {
  'health-scan': 'Health Scan',
  'dependency-analysis': 'Dependency Analysis',
  'ai-report': 'AI Report',
  'engineering-status': 'Engineering Status',
  'repository-overview': 'Repository Overview',
};

function formatWorkflowName(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
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

export const RecentActivity = memo(function RecentActivity({ activities }: RecentActivityProps) {
  const navigate = useNavigate();
  const { sessions, isLoading: sessionsLoading } = useRecentHistory(5);

  const hasActivities = activities.length > 0;
  const hasSessions = sessions.length > 0;

  if (!hasActivities && !hasSessions && !sessionsLoading) {
    return (
      <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Recent Activity</h3>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <History className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start using AI features to see your activity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
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

      <div className="relative space-y-3">
        <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-px bg-border" />

        {activities.slice(0, 5).map((activity) => {
          const Icon = workflowIcons[activity.action] || FileCode;
          const color = workflowColors[activity.action] || 'bg-gray-500';
          const displayName = activity.label || formatWorkflowName(activity.action);
          return (
            <div key={activity.id} className="relative flex items-start gap-3">
              <div
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium">{displayName}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {activity.provider && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {activity.provider}
                    </span>
                  )}
                  {activity.latencyMs != null && activity.latencyMs > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(activity.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {activity.createdAt && <span>{timeAgo(activity.createdAt)}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {sessions.slice(0, 3).map((session) => {
          const Icon = historyIcons[session.workflowType] || MessageSquare;
          const color = workflowColors[session.workflowType] || 'bg-gray-500';
          return (
            <div key={session.id} className="relative flex items-start gap-3">
              <div
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <button
                  onClick={() => navigate(`/history?session=${session.id}`)}
                  className="text-left text-sm font-medium hover:text-primary transition-colors"
                >
                  {session.title}
                </button>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {historyLabels[session.workflowType] ||
                      WORKFLOW_TYPE_LABELS[session.workflowType] ||
                      session.workflowType}
                  </span>
                  <span>{timeAgo(session.updatedAt)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {sessionsLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
});
