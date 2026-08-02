import { GitPullRequest, FileCode, Play, Github, Rocket } from 'lucide-react';

interface ActivityItem {
  id: string;
  action: string;
  resourceType: string;
  metadata: Record<string, unknown> | null;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const actionConfig: Record<string, { icon: typeof Github; label: string; color: string }> = {
  github_connected: { icon: Github, label: 'Connected GitHub', color: 'bg-green-500' },
  pr_reviewed: { icon: GitPullRequest, label: 'Reviewed PR', color: 'bg-blue-500' },
  code_reviewed: { icon: FileCode, label: 'Generated Code Review', color: 'bg-purple-500' },
  report_exported: { icon: Rocket, label: 'Exported Report', color: 'bg-orange-500' },
  prompt_run: { icon: Play, label: 'Ran Prompt', color: 'bg-pink-500' },
};

function getActivityConfig(action: string) {
  return (
    actionConfig[action] || {
      icon: FileCode,
      label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      color: 'bg-gray-500',
    }
  );
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Today&apos;s Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Rocket className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No activity today</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start using DevPilot to see your activity here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Today&apos;s Activity</h3>
      <div className="relative space-y-4">
        <div className="absolute left-[15px] top-2 h-[calc(100%-16px)] w-px bg-border" />
        {activities.slice(0, 6).map((activity) => {
          const config = getActivityConfig(activity.action);
          const Icon = config.icon;
          return (
            <div key={activity.id} className="relative flex items-start gap-3">
              <div className={`relative z-10 rounded-full ${config.color} p-1.5`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium">{config.label}</p>
                {activity.metadata && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {JSON.stringify(activity.metadata)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
