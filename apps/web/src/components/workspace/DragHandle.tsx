import { cn } from '@/lib/utils';

interface DragHandleProps {
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * Visual grip for resizable separators.
 * Render as a child of a react-resizable-panels `Separator`.
 */
export function DragHandle({ orientation = 'vertical', className }: DragHandleProps) {
  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <span
        className={cn(
          'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-muted transition-colors',
          orientation === 'vertical' ? 'h-10 w-3.5' : 'h-3.5 w-10',
          'group-hover:border-primary/50 group-hover:bg-primary/20',
          'group-active:border-primary group-active:bg-primary/30',
          'group-focus-visible:border-primary group-focus-visible:bg-primary/30',
        )}
      >
        {orientation === 'vertical' ? (
          <span className="flex flex-col items-center gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
          </span>
        ) : (
          <span className="flex items-center gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-primary" />
          </span>
        )}
      </span>
    </span>
  );
}
