import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { WorkflowType, AIProviderName, AIHistoryFilters } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: AIHistoryFilters;
  onFiltersChange: (filters: AIHistoryFilters) => void;
  repositories: string[];
  className?: string;
}

const WORKFLOW_TYPES: WorkflowType[] = [
  'playground',
  'code-review',
  'pr-review',
  'pr-analysis',
  'repository-chat',
  'documentation',
  'test-generation',
  'security-review',
  'architecture-review',
];

const PROVIDERS: AIProviderName[] = ['gemini', 'groq', 'openai', 'anthropic', 'openrouter'];

export function FilterPanel({
  filters,
  onFiltersChange,
  repositories,
  className,
}: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workflow: true,
    repository: false,
    provider: false,
    date: false,
    status: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = <K extends keyof AIHistoryFilters>(key: K, value: AIHistoryFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = <T extends string>(key: keyof AIHistoryFilters, value: T) => {
    const current = (filters[key] as T[] | undefined) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, updated.length > 0 ? updated : undefined);
  };

  const activeFilterCount = [
    filters.workflowType?.length,
    filters.repository?.length,
    filters.provider?.length,
    filters.dateFrom || filters.dateTo ? 1 : null,
    filters.favorite ? 1 : null,
    filters.pinned ? 1 : null,
    filters.archived !== undefined ? 1 : null,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const FilterSection = ({
    title,
    sectionKey,
    children,
  }: {
    title: string;
    sectionKey: string;
    children: React.ReactNode;
  }) => (
    <div className="border-b border-input">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="flex w-full items-center justify-between py-3 text-sm font-medium"
      >
        {title}
        {expandedSections[sectionKey] ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections[sectionKey] && <div className="pb-3">{children}</div>}
    </div>
  );

  const CheckboxItem = ({
    checked,
    onChange,
    label,
    count,
  }: {
    checked: boolean;
    onChange: () => void;
    label: string;
    count?: number;
  }) => (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-input"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
    </label>
  );

  return (
    <div className={cn('rounded-xl border border-input bg-card p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      <FilterSection title="Workflow" sectionKey="workflow">
        <div className="space-y-1">
          {WORKFLOW_TYPES.map((type) => (
            <CheckboxItem
              key={type}
              checked={filters.workflowType?.includes(type) || false}
              onChange={() => toggleArrayFilter('workflowType', type)}
              label={WORKFLOW_TYPE_LABELS[type]}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Repository" sectionKey="repository">
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {repositories.map((repo) => (
            <CheckboxItem
              key={repo}
              checked={filters.repository?.includes(repo) || false}
              onChange={() => toggleArrayFilter('repository', repo)}
              label={repo}
            />
          ))}
          {repositories.length === 0 && (
            <p className="text-xs text-muted-foreground">No repositories yet</p>
          )}
        </div>
      </FilterSection>

      <FilterSection title="Provider" sectionKey="provider">
        <div className="space-y-1">
          {PROVIDERS.map((provider) => (
            <CheckboxItem
              key={provider}
              checked={filters.provider?.includes(provider) || false}
              onChange={() => toggleArrayFilter('provider', provider)}
              label={provider.charAt(0).toUpperCase() + provider.slice(1)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Date Range" sectionKey="date">
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Status" sectionKey="status">
        <div className="space-y-1">
          <CheckboxItem
            checked={filters.favorite === true}
            onChange={() => updateFilter('favorite', filters.favorite ? undefined : true)}
            label="Favorites"
          />
          <CheckboxItem
            checked={filters.pinned === true}
            onChange={() => updateFilter('pinned', filters.pinned ? undefined : true)}
            label="Pinned"
          />
          <CheckboxItem
            checked={filters.archived === true}
            onChange={() => updateFilter('archived', filters.archived ? undefined : true)}
            label="Archived"
          />
        </div>
      </FilterSection>
    </div>
  );
}
