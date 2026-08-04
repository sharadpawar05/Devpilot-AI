import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StickyFooterProps {
  children?: React.ReactNode;
  className?: string;
}

function StickyFooter({ children, className }: StickyFooterProps) {
  return (
    <div className={cn('shrink-0 border-t border-border bg-background px-4 py-3', className)}>
      {children}
    </div>
  );
}

interface StickySubmitProps {
  label?: string;
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  shortcutHint?: string;
  error?: string | null;
  className?: string;
}

function StickySubmit({
  label = 'Generate',
  loadingLabel = 'Processing...',
  isLoading,
  disabled,
  onSubmit,
  shortcutHint = 'Ctrl+Enter',
  error,
  className,
}: StickySubmitProps) {
  return (
    <StickyFooter className={className}>
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={disabled || isLoading}
        className="w-full"
        size="default"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          label
        )}
      </Button>
      {shortcutHint && !isLoading && (
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">{shortcutHint}</kbd> to
          submit
        </p>
      )}
    </StickyFooter>
  );
}

export { StickyFooter, StickySubmit };
export type { StickyFooterProps, StickySubmitProps };
