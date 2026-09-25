import { useState } from 'react';
import { Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TechCategory, DetectedTech, TechnologyStack } from '@/lib/repo-overview';
import { CATEGORY_META, CATEGORY_ORDER, STACK_KEY_MAP } from '@/lib/repo-overview';

const COLLAPSED_CATEGORIES = 4;

function CategoryRow({ category, techs }: { category: TechCategory; techs: DetectedTech[] }) {
  const meta = CATEGORY_META[category];

  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className={cn('text-xs font-medium whitespace-nowrap', meta.textColor)}>
        {meta.label}
      </span>
      <span className="text-muted-foreground">·</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {techs.map((tech, i) => (
          <span key={tech.name} className="inline-flex items-center gap-1">
            <span className="text-sm text-foreground">{tech.name}</span>
            {tech.version && (
              <span className="text-[10px] font-mono text-muted-foreground">{tech.version}</span>
            )}
            {i < techs.length - 1 && <span className="text-muted-foreground">·</span>}
          </span>
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
  const [expanded, setExpanded] = useState(false);
  const categories = CATEGORY_ORDER.filter((cat) => {
    const key = STACK_KEY_MAP[cat];
    return stack[key] && (stack[key] as DetectedTech[]).length > 0;
  });

  if (categories.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card px-5 py-3', className)}>
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Technology Stack</span>
          <span className="text-xs text-muted-foreground ml-auto">Analyzing...</span>
        </div>
      </div>
    );
  }

  const totalTechs = categories.reduce((sum, cat) => {
    const key = STACK_KEY_MAP[cat];
    return sum + ((stack[key] as DetectedTech[])?.length || 0);
  }, 0);

  const collapsible = categories.length > COLLAPSED_CATEGORIES;
  const visibleCategories =
    collapsible && !expanded ? categories.slice(0, COLLAPSED_CATEGORIES) : categories;

  return (
    <div className={cn('rounded-lg border bg-card px-5 py-3', className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Technology Stack</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {totalTechs} technologies across {categories.length} categories
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {visibleCategories.map((category) => {
          const key = STACK_KEY_MAP[category];
          const techs = stack[key] as DetectedTech[];
          return <CategoryRow key={category} category={category} techs={techs} />;
        })}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-md border border-dashed px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {expanded ? 'Show less' : `View all (${categories.length} categories)`}
        </button>
      )}
    </div>
  );
}
