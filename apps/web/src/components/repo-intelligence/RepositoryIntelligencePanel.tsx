import { memo } from 'react';
import {
  Brain,
  RefreshCw,
  FileCode,
  Package,
  FlaskConical,
  Paintbrush,
  Layers,
  Wrench,
  Search,
  FileText,
  Database,
} from 'lucide-react';
import { useRepositoryIntelligence, useInvalidateIntelligence } from '@/lib/repo-intelligence';
import type { DetectedTechnology, ProjectType } from '@/lib/repo-intelligence';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RepositoryIntelligenceProps {
  owner: string;
  repo: string;
  branch?: string;
}

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'web-app': 'Web Application',
  api: 'API / Backend',
  library: 'Library / Package',
  cli: 'CLI Tool',
  mobile: 'Mobile App',
  monorepo: 'Monorepo',
  'static-site': 'Static Site',
  unknown: 'Unknown',
};

const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  'web-app': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  api: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  library: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  cli: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  mobile: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  monorepo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'static-site': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  unknown: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  low: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

const SECTION_ICONS = {
  languages: FileCode,
  frameworks: Layers,
  databases: Database,
  orms: Database,
  testing: FlaskConical,
  styling: Paintbrush,
  stateManagement: Layers,
  buildTools: Wrench,
  lintingTools: Search,
  formattingTools: Paintbrush,
} as const;

function TechBadge({ tech }: { tech: DetectedTechnology }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        CONFIDENCE_COLORS[tech.confidence],
      )}
    >
      {tech.name}
      {tech.version && <span className="text-[10px] opacity-60">v{tech.version}</span>}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof FileCode;
  items: DetectedTechnology[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((tech) => (
          <TechBadge key={tech.name} tech={tech} />
        ))}
      </div>
    </div>
  );
}

export const RepositoryIntelligencePanel = memo(function RepositoryIntelligencePanel({
  owner,
  repo,
  branch,
}: RepositoryIntelligenceProps) {
  const { data: intelligence, isLoading, error } = useRepositoryIntelligence(owner, repo, branch);
  const invalidateMutation = useInvalidateIntelligence();

  const handleRefresh = () => {
    invalidateMutation.mutate({ owner, repo });
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold">Repository Intelligence</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Repository Intelligence</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Repository Intelligence</h3>
        </div>
        <p className="text-sm text-muted-foreground">No intelligence data available.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Analyze Repository
        </Button>
      </div>
    );
  }

  const sections = [
    {
      key: 'languages',
      title: 'Languages',
      icon: SECTION_ICONS.languages,
      items: intelligence.detectedLanguages,
    },
    {
      key: 'frameworks',
      title: 'Frameworks',
      icon: SECTION_ICONS.frameworks,
      items: intelligence.detectedFrameworks,
    },
    {
      key: 'databases',
      title: 'Databases',
      icon: SECTION_ICONS.databases,
      items: intelligence.detectedDatabases,
    },
    { key: 'orms', title: 'ORMs', icon: SECTION_ICONS.orms, items: intelligence.detectedORMs },
    {
      key: 'testing',
      title: 'Testing',
      icon: SECTION_ICONS.testing,
      items: intelligence.detectedTesting,
    },
    {
      key: 'styling',
      title: 'Styling',
      icon: SECTION_ICONS.styling,
      items: intelligence.detectedStyling,
    },
    {
      key: 'stateManagement',
      title: 'State Management',
      icon: SECTION_ICONS.stateManagement,
      items: intelligence.detectedStateManagement,
    },
    {
      key: 'buildTools',
      title: 'Build Tools',
      icon: SECTION_ICONS.buildTools,
      items: intelligence.buildTools,
    },
    {
      key: 'lintingTools',
      title: 'Linting',
      icon: SECTION_ICONS.lintingTools,
      items: intelligence.lintingTools,
    },
    {
      key: 'formattingTools',
      title: 'Formatting',
      icon: SECTION_ICONS.formattingTools,
      items: intelligence.formattingTools,
    },
  ];

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Repository Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {new Date(intelligence.generatedAt).toLocaleTimeString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleRefresh}
            disabled={invalidateMutation.isPending}
          >
            <RefreshCw className={cn('h-3 w-3', invalidateMutation.isPending && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground mb-4">{intelligence.repositorySummary}</p>

      {/* Project Type + Package Manager */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
            PROJECT_TYPE_COLORS[intelligence.projectType],
          )}
        >
          {PROJECT_TYPE_LABELS[intelligence.projectType]}
        </span>
        {intelligence.packageManager !== 'unknown' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            <Package className="h-3 w-3" />
            {intelligence.packageManager}
          </span>
        )}
      </div>

      {/* Technology Sections */}
      <div className="space-y-3">
        {sections.map((s) => (
          <Section key={s.key} title={s.title} icon={s.icon} items={s.items} />
        ))}
      </div>

      {/* Important Files */}
      {intelligence.importantFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" />
            Important Files
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {intelligence.importantFiles.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate font-mono">{f.path}</span>
                <span className="ml-auto text-muted-foreground shrink-0">{f.purpose}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
