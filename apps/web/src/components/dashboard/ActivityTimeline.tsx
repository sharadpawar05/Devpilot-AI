import {
  GitPullRequest,
  FileCode,
  Play,
  Github,
  Rocket,
  MessageSquare,
  BookOpen,
  FlaskConical,
  Shield,
  Layout,
  Zap,
} from 'lucide-react';

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

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const workflowIcons: Record<string, typeof Github> = {
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
};

const workflowColors: Record<string, string> = {
  playground: 'bg-pink-500',
  code_review: 'bg-purple-500',
  'code-review': 'bg-purple-500',
  pr_review: 'bg-blue-500',
  'pr-review': 'bg-blue-500',
  pr_analysis: 'bg-blue-500',
  'pr-analysis': 'bg-blue-500',
  repository_chat: 'bg-green-500',
  'repository-chat': 'bg-green-500',
  documentation: 'bg-orange-500',
  test_generation: 'bg-amber-500',
  'test-generation': 'bg-amber-500',
  security_review: 'bg-red-500',
  'security-review': 'bg-red-500',
  architecture_review: 'bg-indigo-500',
  'architecture-review': 'bg-indigo-500',
  github_connected: 'bg-green-500',
};

function formatWorkflowName(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
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

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Today&apos;s Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Rocket className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start using DevPilot to see your activity here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
      <div className="relative space-y-4">
        <div className="absolute left-[15px] top-2 h-[calc(100%-16px)] w-px bg-border" />
        {activities.slice(0, 8).map((activity) => {
          const Icon = workflowIcons[activity.action] || FileCode;
          const color = workflowColors[activity.action] || 'bg-gray-500';
          const displayName = activity.label || formatWorkflowName(activity.action);
          return (
            <div key={activity.id} className="relative flex items-start gap-3">
              <div className={`relative z-10 rounded-full ${color} p-1.5`}>
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
                    <span>{(activity.latencyMs / 1000).toFixed(1)}s</span>
                  )}
                  {activity.createdAt && <span>{timeAgo(activity.createdAt)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
