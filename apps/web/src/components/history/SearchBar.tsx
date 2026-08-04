import { memo, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Search by prompt, repository, model, or feature...',
  className,
  autoFocus,
}: SearchBarProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>('[data-history-search]');
      input?.focus();
      input?.select();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        data-history-search
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-20 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {value && (
          <button
            onClick={() => onChange('')}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="hidden select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          /
        </kbd>
      </div>
    </div>
  );
});
