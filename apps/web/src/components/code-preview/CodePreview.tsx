import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, FileCode, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { getLanguageFromPath } from './language';
import { CodePreviewEmptyState } from './CodePreviewEmptyState';
import { FileHeader } from './FileHeader';
import { CodeDisplay } from './CodeDisplay';
import { SearchBar } from './SearchBar';
import { Minimap } from './Minimap';

export interface CodePreviewProps {
  file: string | null;
  content?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

const MINIMAP_THRESHOLD = 50;

export function CodePreview({
  file,
  content,
  isLoading = false,
  error = null,
  onRetry,
  className,
}: CodePreviewProps) {
  const { theme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const wasSearchOpen = useRef(false);

  const language = useMemo(() => (file ? getLanguageFromPath(file) : 'plaintext'), [file]);
  const lines = useMemo(() => (content ? content.split('\n') : []), [content]);

  const matchCount = useMemo(() => {
    if (!searchQuery || !content) return 0;
    const q = searchQuery.toLowerCase();
    const haystack = content.toLowerCase();
    let count = 0;
    let idx = haystack.indexOf(q);
    while (idx !== -1) {
      count++;
      idx = haystack.indexOf(q, idx + q.length);
    }
    return count;
  }, [content, searchQuery]);

  // Reset search state when file changes
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
    setActiveLine(null);
  }, [file]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  // Ctrl/Cmd+F opens search when a file is loaded
  useEffect(() => {
    if (!file || !content) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [file, content]);

  // Escape closes search
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [searchOpen]);

  // Restore focus flag when search closes
  useEffect(() => {
    if (wasSearchOpen.current && !searchOpen) {
      wasSearchOpen.current = false;
    }
    if (searchOpen) wasSearchOpen.current = true;
  }, [searchOpen]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((v) => !v);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    if (matchCount === 0) return;
    setActiveMatchIndex((i) => (i + 1) % matchCount);
  }, [matchCount]);

  const handlePrev = useCallback(() => {
    if (matchCount === 0) return;
    setActiveMatchIndex((i) => (i - 1 + matchCount) % matchCount);
  }, [matchCount]);

  if (!file) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)} data-testid="code-preview">
        <CodePreviewEmptyState variant="no-selection" />
      </div>
    );
  }

  const fileName = file.split('/').pop() ?? file;

  return (
    <div
      className={cn('code-preview flex h-full min-h-0 flex-col', className)}
      data-testid="code-preview"
      data-theme={theme}
    >
      <FileHeader
        path={file}
        language={language}
        lineCount={lines.length}
        byteSize={content ? new Blob([content]).size : undefined}
        content={content ?? ''}
        searchOpen={searchOpen}
        onToggleSearch={handleToggleSearch}
        onRetry={onRetry}
      />

      {searchOpen && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          matchCount={matchCount}
          activeMatchIndex={activeMatchIndex}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={handleSearchClose}
        />
      )}

      <div className="relative flex min-h-0 flex-1">
        {isLoading && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3"
            role="status"
            aria-label="Loading file"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading {fileName}…</p>
          </div>
        )}

        {error && !isLoading && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
            role="alert"
          >
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            </div>
            <p className="text-sm font-medium">Unable to load file</p>
            <p className="max-w-[260px] text-xs text-muted-foreground">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && content !== undefined && content !== null && content !== '' && (
          <>
            <CodeDisplay
              content={content}
              language={language}
              activeLine={activeLine}
              searchQuery={searchQuery}
              activeMatchIndex={searchQuery ? activeMatchIndex : -1}
              onLineClick={setActiveLine}
              onActiveLineChange={setActiveLine}
            />
            {lines.length > MINIMAP_THRESHOLD && (
              <Minimap
                lines={lines}
                activeLine={activeLine ?? 1}
                onScrollToLine={(n) => setActiveLine(n + 1)}
              />
            )}
          </>
        )}

        {!isLoading && !error && content === '' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
              <FileCode className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            </div>
            <p className="text-sm font-medium">Empty file</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">This file has no content.</p>
          </div>
        )}

        {!isLoading && !error && (content === undefined || content === null) && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
              <FileCode className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            </div>
            <p className="text-sm font-medium">Waiting for file</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Select a file with repository context to load its contents.
            </p>
          </div>
        )}
      </div>

      {!isLoading && !error && content != null && content !== '' && (
        <footer className="flex shrink-0 items-center justify-between border-t border-input bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
          <span>
            {lines.length} lines · {content.length.toLocaleString()} chars
          </span>
          <span className="uppercase tracking-wide">{language}</span>
        </footer>
      )}
    </div>
  );
}
