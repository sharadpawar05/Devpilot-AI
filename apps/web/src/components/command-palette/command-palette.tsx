import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  X,
  Clock,
  History,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyMatch, fuzzyFilter, highlightMatches } from '@/lib/fuzzy-search';
import { useGitHub } from '@/hooks/use-github';
import { useCommandPalette, addRecentCommand, getRecentCommands } from './context';
import { commands, type Command as CommandType } from './commands';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from './recent-searches';

type FilterId = 'all' | string;

function uniqueGroups(list: CommandType[]): string[] {
  return [...new Set(list.map((cmd) => cmd.group))];
}

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const navigate = useNavigate();
  const gh = useGitHub();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => uniqueGroups(commands), []);

  useEffect(() => {
    if (isOpen) {
      setRecentIds(getRecentCommands());
      setRecentSearches(getRecentSearches());
      setQuery('');
      setFilter('all');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    const pool = filter === 'all' ? commands : commands.filter((cmd) => cmd.group === filter);
    if (!query.trim()) return pool;
    return fuzzyFilter(query, pool, (cmd) => [cmd.label, cmd.group, cmd.id]).map((r) => r.item);
  }, [query, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, CommandType[]> = {};
    for (const cmd of filteredCommands) {
      if (!map[cmd.group]) map[cmd.group] = [];
      map[cmd.group].push(cmd);
    }
    return map;
  }, [filteredCommands]);

  const recentCommands = useMemo(() => {
    if (query.trim() || filter !== 'all') return [];
    return recentIds
      .map((id) => commands.find((c) => c.id === id))
      .filter(Boolean)
      .slice(0, 5) as CommandType[];
  }, [recentIds, query, filter]);

  const showRecentSearches = !query.trim() && filter === 'all' && recentSearches.length > 0;

  const flatCommands = useMemo(
    () => [...(showRecentSearches ? [] : []), ...filteredCommands],
    [filteredCommands, showRecentSearches],
  );

  const executeCommand = useCallback(
    (cmd: CommandType) => {
      addRecentCommand(cmd.id);
      if (query.trim().length >= 2) {
        setRecentSearches(addRecentSearch(query));
      }
      close();

      if (cmd.action === 'navigate' && cmd.href) {
        navigate(cmd.href);
      } else if (cmd.handler) {
        executeHandler(cmd.handler, gh, navigate);
      }
    },
    [close, navigate, gh, query],
  );

  const applySearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setRecentSearches(addRecentSearch(trimmed));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            executeCommand(flatCommands[selectedIndex]);
          } else if (query.trim()) {
            setRecentSearches(addRecentSearch(query));
          }
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close, flatCommands, selectedIndex, executeCommand, query]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filter]);

  if (!isOpen) return null;

  let currentIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-background shadow-2xl animate-scale-in">
        {/* Input */}
        <div className="flex items-center gap-3 border-b px-4">
          <Search
            className="h-4 w-4 shrink-0 text-muted-foreground"
            data-testid="palette-search-icon"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, pages, actions..."
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search commands"
          />
          <kbd className="hidden select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        {/* Filter chips */}
        <div
          className="flex flex-wrap gap-1.5 border-b bg-muted/30 px-3 py-2"
          role="tablist"
          aria-label="Command filters"
        >
          {(['all', ...groups] as FilterId[]).map((id) => {
            const active = filter === id;
            const label = id === 'all' ? 'All' : id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto p-2"
          data-testid="palette-results"
        >
          {/* Recent searches */}
          {showRecentSearches && (
            <div className="mb-2" data-testid="recent-searches">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Recent searches</span>
                <button
                  type="button"
                  onClick={() => setRecentSearches(clearRecentSearches())}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => applySearch(term)}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
                  >
                    <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent commands */}
          {recentCommands.length > 0 && (
            <div className="mb-2" data-testid="recent-commands">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Recent</div>
              {recentCommands.map((cmd) => {
                currentIndex++;
                const idx = currentIndex;
                return (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    query=""
                    index={idx}
                    isSelected={idx === selectedIndex}
                    onSelect={() => executeCommand(cmd)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          )}

          {/* Grouped commands */}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</div>
              {items.map((cmd) => {
                currentIndex++;
                const idx = currentIndex;
                return (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    query={query}
                    index={idx}
                    isSelected={idx === selectedIndex}
                    onSelect={() => executeCommand(cmd)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          ))}

          {/* Empty state */}
          {flatCommands.length === 0 && (
            <div
              className="flex flex-col items-center gap-2 py-8 text-center"
              data-testid="empty-results"
            >
              <History className="h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">No commands found for “{query}”</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reset search
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">esc</kbd>
            close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <X className="h-3 w-3" aria-hidden />
            filter: {filter === 'all' ? 'all' : filter}
          </span>
        </div>
      </div>
    </div>
  );
}

function CommandItem({
  cmd,
  query,
  index,
  isSelected,
  onSelect,
  onHover,
}: {
  cmd: CommandType;
  query: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const match = query ? fuzzyMatch(query, cmd.label) : null;
  const Icon: LucideIcon = cmd.icon;

  return (
    <button
      data-index={index}
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none transition-colors',
        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50',
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-left">
        {match ? highlightMatches(cmd.label, match.indices) : cmd.label}
      </span>
      <span className="text-xs text-muted-foreground">{cmd.group}</span>
      {cmd.shortcut && (
        <kbd className="select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {cmd.shortcut}
        </kbd>
      )}
    </button>
  );
}

function executeHandler(
  handler: string,
  gh: ReturnType<typeof useGitHub>,
  navigate: ReturnType<typeof useNavigate>,
) {
  switch (handler) {
    case 'gh:connect':
      gh.connect('/dashboard');
      break;
    case 'gh:disconnect':
      gh.disconnect();
      break;
    case 'gh:switch-repo':
      navigate('/github');
      break;
    case 'gh:refresh':
      gh.refreshConnection();
      break;
    case 'ai:new-playground':
      navigate('/playground');
      break;
    case 'ai:gen-docs':
      navigate('/playground?template=documentation');
      break;
    case 'ai:gen-tests':
      navigate('/playground?template=write-tests');
      break;
    case 'hist:continue':
      navigate('/history');
      break;
  }
}
