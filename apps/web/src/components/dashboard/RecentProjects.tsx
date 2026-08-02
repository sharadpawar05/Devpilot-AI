import { Folder, ExternalLink } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  repository?: string;
  lastActivity?: string;
}

interface RecentProjectsProps {
  projects: Project[];
  onOpen?: (project: Project) => void;
}

export function RecentProjects({ projects, onOpen }: RecentProjectsProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Recent Projects</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Folder className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Projects feature coming soon. Stay tuned!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Projects</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Coming Soon
        </span>
      </div>
      <div className="space-y-2">
        {projects.slice(0, 3).map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpen?.(project)}
            className="flex w-full items-center justify-between rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.name}</p>
              {project.repository && (
                <p className="mt-0.5 text-xs text-muted-foreground">{project.repository}</p>
              )}
            </div>
            <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
