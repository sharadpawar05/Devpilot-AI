import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onBack?: () => void;
  backLabel?: string;
  breadcrumb?: React.ReactNode;
}

function PageHeader({
  title,
  description,
  actions,
  children,
  className,
  onBack,
  backLabel,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border px-5 py-2.5 shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 w-7 p-0 shrink-0"
            aria-label={backLabel ?? 'Go back'}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          {breadcrumb && (
            <div className="mb-0.5 text-[10px] text-muted-foreground">{breadcrumb}</div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            {description && (
              <span className="truncate text-xs text-muted-foreground hidden sm:inline">
                {description}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
