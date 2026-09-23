import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Clock, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyFilter, highlightMatches, fuzzyMatch } from '@/lib/fuzzy-search';
import { useGitHub } from '@/hooks/use-github';
import { useCommandPalette } from '@/components/command-palette';
import { commands, type Command as CommandType } from '@/components/command-palette/commands';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
} from '@/components/command-palette/recent-searches';

const RECENT_LIMIT = 5;
const RESULT_LIMIT = 8;

export function SearchBar() {
  const navigate = useNavigate();
  const gh = useGitHub();
  const { open: openPalette } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuzzyFilter(query, commands, (cmd) => [cmd.label, cmd.group, cmd.id])
      .slice(0, RESULT_LIMIT)
      .map((r) => r.item);
  }, [query]);

  const showRecents = isOpen && !query.trim() && recentSearches.length > 0;
  const showDropdown = isOpen && (Boolean(query.trim()) || showRecents);
  const flatResults = query.trim() ? results : [];

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  const runCommand = useCallback(
    (cmd: CommandType) => {
      if (query.trim().length >= 2) {
        setRecentSearches(addRecentSearch(query));
      }
      setIsOpen(false);
      setQuery('');

      if (cmd.action === 'navigate' && cmd.href) {
        navigate(cmd.href);
        return;
      }

      switch (cmd.handler) {
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
          navigate('/playground?template=readme-generator');
          break;
        case 'ai:gen-tests':
          navigate('/playground?template=generate-tests');
          break;
        case 'hist:continue':
          navigate('/history');
          break;
        default:
          break;
      }
    },
    [gh, navigate, query],
  );

  const applyRecent = useCallback((term: string) => {
    setQuery(term);
    inputRef.current?.focus();
    setRecentSearches(addRecentSearch(term));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Cmd/Ctrl+K is handled globally by CommandPaletteProvider (document listener).
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = query.trim()
        ? flatResults.length - 1
        : Math.min(recentSearches.length, RECENT_LIMIT) - 1;
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(max, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && flatResults[selectedIndex]) {
        runCommand(flatResults[selectedIndex]);
      } else if (!query.trim() && recentSearches[selectedIndex]) {
        applyRecent(recentSearches[selectedIndex]);
      } else if (query.trim()) {
        setRecentSearches(addRecentSearch(query));
        openPalette();
        setIsOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md flex-1">
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm transition-all duration-150',
          isOpen
            ? 'border-primary/50 bg-background shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search commands, pages..."
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          aria-label="Search commands"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          role="combobox"
          aria-autocomplete="list"
        />
        <button
          type="button"
          onClick={() => openPalette()}
          className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground sm:flex"
          aria-label="Open command palette"
        >
          <Command className="h-3 w-3" aria-hidden />K
        </button>
      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg"
          data-testid="search-dropdown"
        >
          {query.trim() ? (
            flatResults.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto p-1.5">
                {flatResults.map((cmd, index) => {
                  const match = fuzzyMatch(query, cmd.label);
                  const Icon = cmd.icon;
                  return (
                    <li key={cmd.id} role="option" aria-selected={index === selectedIndex}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                          index === selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50',
                        )}
                        onClick={() => runCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="flex-1 truncate">
                          {match ? highlightMatches(cmd.label, match.indices) : cmd.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{cmd.group}</span>
                        {index === selectedIndex && (
                          <CornerDownLeft className="h-3 w-3 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No results for “{query}”
              </div>
            )
          ) : showRecents ? (
            <div className="p-1.5" data-testid="search-recent">
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
              <ul>
                {recentSearches.slice(0, RECENT_LIMIT).map((term, index) => (
                  <li key={term} role="option" aria-selected={index === selectedIndex}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                        index === selectedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50',
                      )}
                      onClick={() => applyRecent(term)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex-1 truncate">{term}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" />
              navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              select
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openPalette();
              }}
              className="ml-auto font-medium text-primary hover:underline"
            >
              All commands
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
