import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  activeMatchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  matchCount,
  activeMatchIndex,
  onNext,
  onPrev,
  onClose,
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (next: string) => {
      setLocalValue(next);
      onChange(next);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) onPrev();
        else onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onNext, onPrev, onClose],
  );

  const counterLabel =
    value && matchCount > 0 ? `${activeMatchIndex + 1}/${matchCount}` : value ? '0/0' : '';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border-b border-input bg-muted/50 px-3 py-1.5',
        className,
      )}
      role="search"
      data-testid="code-search-bar"
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />

      <label htmlFor="code-preview-search" className="sr-only">
        Search in file
      </label>
      <input
        ref={inputRef}
        id="code-preview-search"
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in file…"
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
        autoComplete="off"
        spellCheck={false}
        data-testid="code-search-input"
      />

      {counterLabel && (
        <span
          className="shrink-0 tabular-nums text-xs text-muted-foreground"
          aria-live="polite"
          data-testid="search-counter"
        >
          {counterLabel}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!matchCount}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!matchCount}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next match"
          title="Next match (Enter)"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close search"
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
