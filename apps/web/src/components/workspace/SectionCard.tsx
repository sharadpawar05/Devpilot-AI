import { useState } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  accent?: string;
  defaultOpen?: boolean;
  copyContent?: string;
  children: React.ReactNode;
  className?: string;
}

function SectionCard({
  title,
  accent,
  defaultOpen = true,
  copyContent,
  children,
  className,
}: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!copyContent) return;
    navigator.clipboard.writeText(copyContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-border/80',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        {accent && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        )}
        <span className="text-sm font-medium flex-1">{title}</span>
        {copyContent && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleCopy}
            onKeyDown={(e) => e.key === 'Enter' && handleCopy(e as any)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 hover:bg-muted"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="border-t border-border px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

export { SectionCard };
