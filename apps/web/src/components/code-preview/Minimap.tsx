import { useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MinimapProps {
  lines: string[];
  activeLine: number;
  onScrollToLine: (lineIndex: number) => void;
  className?: string;
}

const MINIMAP_LINE_HEIGHT = 3;
const MINIMAP_WIDTH = 60;

export function Minimap({ lines, activeLine, onScrollToLine, className }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const lineIndex = Math.min(lines.length - 1, Math.max(0, Math.floor(ratio * lines.length)));
      onScrollToLine(lineIndex);
    },
    [lines.length, onScrollToLine],
  );

  const ticks = useMemo(() => {
    const max = Math.min(lines.length, 400);
    const step = Math.max(1, Math.floor(lines.length / max));
    const result: Array<{ index: number; density: number; isComment: boolean }> = [];
    for (let i = 0; i < lines.length; i += step) {
      const line = lines[i];
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*');
      const density = Math.min(1, line.length / 80);
      result.push({ index: i, density, isComment });
    }
    return result;
  }, [lines]);

  const viewportTop = lines.length > 0 ? (activeLine / lines.length) * 100 : 0;
  const viewportHeight = Math.min(100, (40 / Math.max(lines.length, 1)) * 100);

  return (
    <div
      ref={containerRef}
      className={cn(
        'code-preview-minimap relative w-[60px] shrink-0 cursor-pointer overflow-hidden border-l border-input bg-muted/30 select-none',
        'hidden lg:block',
        className,
      )}
      onClick={handleClick}
      role="presentation"
      aria-hidden
      data-testid="code-minimap"
      style={{ width: MINIMAP_WIDTH }}
    >
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: `${lines.length * MINIMAP_LINE_HEIGHT}px` }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.index}
            className="absolute left-1 right-1 rounded-[1px]"
            style={{
              top: tick.index * MINIMAP_LINE_HEIGHT,
              height: MINIMAP_LINE_HEIGHT - 1,
              width: `${Math.max(15, tick.density * 100)}%`,
              backgroundColor: tick.isComment ? 'var(--minimap-comment)' : 'var(--minimap-code)',
              opacity: tick.isComment ? 0.5 : 0.35 + tick.density * 0.4,
            }}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 rounded-sm bg-primary/10 ring-1 ring-primary/20"
        style={{
          top: `${viewportTop}%`,
          height: `${Math.max(viewportHeight, 4)}%`,
        }}
      />
      <div className="pointer-events-none absolute bottom-1 left-1 text-[8px] tabular-nums text-muted-foreground/60">
        {lines.length}
      </div>
    </div>
  );
}
