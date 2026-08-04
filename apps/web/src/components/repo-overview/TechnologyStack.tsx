import {
  Layout,
  Monitor,
  Server,
  Database,
  Link,
  Palette,
  FlaskConical,
  CheckCircle,
  Brain,
  Shield,
  Rocket,
  Package,
  Wrench,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TechCategory, DetectedTech, TechnologyStack } from '@/lib/repo-overview';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  STACK_KEY_MAP,
  getConfidenceColor,
} from '@/lib/repo-overview';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Layout,
  Monitor,
  Server,
  Database,
  Link,
  Palette,
  FlaskConical,
  CheckCircle,
  Brain,
  Shield,
  Rocket,
  Package,
  Wrench,
  Zap,
};

function TechBadge({
  tech,
  meta,
}: {
  tech: DetectedTech;
  meta: { bgColor: string; textColor: string; color: string };
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 transition-all hover:border-border hover:shadow-sm',
        meta.bgColor,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-medium truncate', meta.textColor)}>{tech.name}</span>
          {tech.version && (
            <span className="text-[10px] font-mono text-muted-foreground">v{tech.version}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="h-1 flex-1 max-w-[60px] rounded-full bg-border/50 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                tech.confidence >= 95
                  ? 'bg-emerald-500'
                  : tech.confidence >= 85
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/50',
              )}
              style={{ width: `${tech.confidence}%` }}
            />
          </div>
          <span className={cn('text-[10px] font-mono', getConfidenceColor(tech.confidence))}>
            {tech.confidence}%
          </span>
        </div>
      </div>
    </div>
  );
}

function CategorySection({ category, techs }: { category: TechCategory; techs: DetectedTech[] }) {
  const meta = CATEGORY_META[category];
  const Icon = ICONS[meta.icon] || Zap;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', meta.color)} />
        <h4 className={cn('text-sm font-semibold', meta.textColor)}>{meta.label}</h4>
        <span className="text-[10px] font-mono text-muted-foreground">{techs.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {techs.map((tech) => (
          <TechBadge key={tech.name} tech={tech} meta={meta} />
        ))}
      </div>
    </div>
  );
}

interface TechnologyStackProps {
  stack: TechnologyStack;
  className?: string;
}

export function TechnologyStackCard({ stack, className }: TechnologyStackProps) {
  const categories = CATEGORY_ORDER.filter((cat) => {
    const key = STACK_KEY_MAP[cat];
    return stack[key] && (stack[key] as DetectedTech[]).length > 0;
  });

  if (categories.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Layout className="h-5 w-5 text-muted-foreground" />
          Technology Stack
        </h2>
        <p className="text-sm text-muted-foreground text-center py-4">Analyzing repository...</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layout className="h-5 w-5 text-muted-foreground" />
          Technology Stack
        </h2>
        <span className="text-xs text-muted-foreground">
          {categories.length} categories detected
        </span>
      </div>
      <div className="space-y-5">
        {categories.map((category) => {
          const key = STACK_KEY_MAP[category];
          const techs = stack[key] as DetectedTech[];
          return <CategorySection key={category} category={category} techs={techs} />;
        })}
      </div>
    </div>
  );
}
