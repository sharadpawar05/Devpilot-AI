import { useState, useCallback, Fragment, type ReactNode } from 'react';
import { Group, Panel, Separator, type GroupProps } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';

export interface SplitViewPanel {
  id: string;
  label: string;
  content: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
}

interface SplitViewLayoutProps {
  panels: SplitViewPanel[];
  className?: string;
  storageKey?: string;
  groupProps?: Partial<GroupProps>;
  defaultMobilePanel?: string;
}

const DEFAULT_SIZES: Record<number, number[]> = {
  2: [40, 60],
  3: [22, 28, 50],
};

function renderPanelBody(panel: SplitViewPanel) {
  return (
    <div className="flex h-full min-h-0 flex-col" role="region" aria-label={`${panel.label} panel`}>
      {panel.header}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{panel.content}</div>
      {panel.footer}
    </div>
  );
}

export function SplitViewLayout({
  panels,
  className,
  storageKey,
  groupProps,
  defaultMobilePanel,
}: SplitViewLayoutProps) {
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState(defaultMobilePanel ?? panels[0]?.id);

  const [defaultLayout] = useState(() => {
    if (!storageKey) return undefined;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore parse errors */
    }
    return undefined;
  });

  const handleLayoutChange = useCallback(
    (layout: { [id: string]: number }) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch {
          /* ignore storage errors */
        }
      }
    },
    [storageKey],
  );

  if (isMobile) {
    const active = panels.find((p) => p.id === mobilePanel) ?? panels[0];

    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        <div
          role="tablist"
          aria-label="Workspace panels"
          className="flex gap-1 border-b bg-card p-1.5"
        >
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={panel.id === active?.id}
              aria-controls={`panel-${panel.id}`}
              id={`tab-${panel.id}`}
              onClick={() => setMobilePanel(panel.id)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.98]',
                panel.id === active?.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {panel.label}
            </button>
          ))}
        </div>
        <div
          className="min-h-0 flex-1 overflow-hidden"
          role="tabpanel"
          id={`panel-${active?.id}`}
          aria-labelledby={`tab-${active?.id}`}
        >
          {active && renderPanelBody(active)}
        </div>
      </div>
    );
  }

  const defaults = DEFAULT_SIZES[panels.length] ?? panels.map(() => 100 / panels.length);

  return (
    <Group
      orientation="horizontal"
      className={cn('flex h-full min-h-0', className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChange}
      {...groupProps}
    >
      {panels.map((panel, index) => (
        <Fragment key={panel.id}>
          {index > 0 && (
            <Separator
              aria-label={`Resize ${panels[index - 1].label} and ${panel.label} panels`}
              className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none"
            />
          )}
          <Panel
            id={panel.id}
            defaultSize={String(defaultLayout?.[panel.id] ?? panel.defaultSize ?? defaults[index])}
            minSize={String(panel.minSize ?? 12)}
            maxSize={panel.maxSize != null ? String(panel.maxSize) : undefined}
          >
            {renderPanelBody(panel)}
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}
