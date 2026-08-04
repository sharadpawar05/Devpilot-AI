import { memo } from 'react';
import { Shield, GitPullRequest, Github, Cpu } from 'lucide-react';

interface WorkspaceStatusProps {
  repoHealthScore: number | null;
  pendingPRReviews: number;
  githubConnected: boolean;
  lastAIModel: string | null;
}

export const WorkspaceStatus = memo(function WorkspaceStatus({
  repoHealthScore,
  pendingPRReviews,
  githubConnected,
  lastAIModel,
}: WorkspaceStatusProps) {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Workspace Status</h3>
      <div className="space-y-3">
        <StatusRow
          icon={Shield}
          label="Repository Health"
          value={
            repoHealthScore != null ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  repoHealthScore >= 80
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : repoHealthScore >= 50
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {repoHealthScore}/100
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No data</span>
            )
          }
        />
        <StatusRow
          icon={GitPullRequest}
          label="PR Reviews Pending"
          value={
            pendingPRReviews > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {pendingPRReviews}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                None
              </span>
            )
          }
        />
        <StatusRow
          icon={Github}
          label="GitHub Status"
          value={
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                githubConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  githubConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                }`}
              />
              {githubConnected ? 'Connected' : 'Disconnected'}
            </span>
          }
        />
        <StatusRow
          icon={Cpu}
          label="Last AI Model"
          value={
            lastAIModel ? (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                {lastAIModel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )
          }
        />
      </div>
    </div>
  );
});

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      {value}
    </div>
  );
}
