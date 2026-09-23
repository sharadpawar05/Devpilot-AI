import { useState, useCallback } from 'react';
import { Group, Panel, Separator, type GroupProps } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { getPanelLayout, setPanelLayout } from '@/lib/ui-preferences';
import { DragHandle } from './DragHandle';

interface WorkspaceLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftSize?: number;
  minLeftSize?: number;
  maxLeftSize?: number;
  className?: string;
  groupProps?: Partial<GroupProps>;
  storageKey?: string;
  leftHeader?: React.ReactNode;
  rightHeader?: React.ReactNode;
  leftFooter?: React.ReactNode;
  rightFooter?: React.ReactNode;
  mobileActivePanel?: 'left' | 'right';
  onMobilePanelChange?: (panel: 'left' | 'right') => void;
}

function WorkspaceLayout({
  left,
  right,
  defaultLeftSize = 40,
  minLeftSize = 25,
  maxLeftSize = 65,
  className,
  groupProps,
  storageKey,
  leftHeader,
  rightHeader,
  leftFooter,
  rightFooter,
  mobileActivePanel = 'left',
  onMobilePanelChange,
}: WorkspaceLayoutProps) {
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right'>(mobileActivePanel);

  const handleMobilePanelChange = useCallback(
    (panel: 'left' | 'right') => {
      setMobilePanel(panel);
      onMobilePanelChange?.(panel);
    },
    [onMobilePanelChange],
  );

  const [defaultLayout] = useState(() => (storageKey ? getPanelLayout(storageKey) : undefined));

  const handleLayoutChange = useCallback(
    (layout: { [id: string]: number }) => {
      if (storageKey) setPanelLayout(storageKey, layout);
    },
    [storageKey],
  );

  if (isMobile) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        <div className="flex border-b border-border bg-background">
          <button
            type="button"
            onClick={() => handleMobilePanelChange('left')}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              mobilePanel === 'left'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => handleMobilePanelChange('right')}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              mobilePanel === 'right'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Response
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobilePanel === 'left' ? (
            <div className="flex h-full flex-col">
              {leftHeader}
              <div className="flex-1 min-h-0 overflow-y-auto">{left}</div>
              {leftFooter}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {rightHeader}
              <div className="flex-1 min-h-0 overflow-y-auto">{right}</div>
              {rightFooter}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      className={cn('flex h-full min-h-0', className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChange}
      {...groupProps}
    >
      <Panel
        defaultSize={defaultLayout?.left ?? defaultLeftSize}
        minSize={minLeftSize}
        maxSize={maxLeftSize}
        id="left"
      >
        <div className="flex h-full flex-col">
          {leftHeader}
          <div className="flex-1 min-h-0 overflow-y-auto">{left}</div>
          {leftFooter}
        </div>
      </Panel>
      <Separator
        aria-label="Resize editor and response panels"
        className="group relative w-2 shrink-0 cursor-col-resize bg-border/50 transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none active:bg-primary/60"
      >
        <DragHandle />
      </Separator>
      <Panel
        defaultSize={defaultLayout?.right ?? 100 - defaultLeftSize}
        minSize={35}
        maxSize={75}
        id="right"
      >
        <div className="flex h-full flex-col">
          {rightHeader}
          <div className="flex-1 min-h-0 overflow-y-auto">{right}</div>
          {rightFooter}
        </div>
      </Panel>
    </Group>
  );
}

export { WorkspaceLayout };
export type { WorkspaceLayoutProps };
