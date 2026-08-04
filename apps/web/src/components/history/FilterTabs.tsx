import { memo } from 'react';
import { Layers, FileCode, GitPullRequest, MessageSquare, Play, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FilterTab =
  'all' | 'code-review' | 'pr-assistant' | 'repository-chat' | 'playground' | 'github-review';

interface FilterTabsProps {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
  counts?: Partial<Record<FilterTab, number>>;
}

const tabs: { key: FilterTab; label: string; icon: typeof Layers }[] = [
  { key: 'all', label: 'All', icon: Layers },
  { key: 'code-review', label: 'Code Review', icon: FileCode },
  { key: 'pr-assistant', label: 'PR Assistant', icon: GitPullRequest },
  { key: 'repository-chat', label: 'Repository Chat', icon: MessageSquare },
  { key: 'playground', label: 'Playground', icon: Play },
  { key: 'github-review', label: 'GitHub Review', icon: Folder },
];

export const FilterTabs = memo(function FilterTabs({ active, onChange, counts }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  isActive ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
