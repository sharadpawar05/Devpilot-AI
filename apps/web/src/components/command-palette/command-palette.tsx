import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGitHub } from '@/hooks/use-github';
import { useCommandPalette, addRecentCommand, getRecentCommands } from './context';
import { commands, type Command as CommandType } from './commands';
import { fuzzyMatch, highlightMatches } from './fuzzy';

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const navigate = useNavigate();
  const gh = useGitHub();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recent commands on open
  useEffect(() => {
    if (isOpen) {
      setRecentIds(getRecentCommands());
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((cmd) => {
        const match = fuzzyMatch(query, cmd.label);
        return match ? { cmd, match } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.match.score - a!.match.score)
      .map((item) => item!.cmd);
  }, [query]);

  // Group commands
  const grouped = useMemo(() => {
    const groups: Record<string, CommandType[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Flat list for arrow navigation
  const flatCommands = useMemo(() => filteredCommands, [filteredCommands]);

  // Recent commands (filtered to only those still in the list)
  const recentCommands = useMemo(() => {
    if (query.trim()) return [];
    return recentIds
      .map((id) => commands.find((c) => c.id === id))
      .filter(Boolean) as CommandType[];
  }, [recentIds, query]);

  // Execute command
  const executeCommand = useCallback(
    (cmd: CommandType) => {
      addRecentCommand(cmd.id);
      close();

      if (cmd.action === 'navigate' && cmd.href) {
        navigate(cmd.href);
      } else if (cmd.handler) {
        executeHandler(cmd.handler, gh, navigate);
      }
    },
    [close, navigate, gh],
  );

  // Keyboard navigation
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
          }
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close, flatCommands, selectedIndex, executeCommand]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let currentIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      {/* Palette */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-background shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {/* Recent commands */}
          {recentCommands.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Recent</div>
              {recentCommands.map((cmd) => {
                currentIndex++;
                const idx = currentIndex;
                return (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
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
            <div className="py-6 text-center text-sm text-muted-foreground">No commands found</div>
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
        </div>
      </div>
    </div>
  );
}

function CommandItem({
  cmd,
  index,
  isSelected,
  onSelect,
  onHover,
}: {
  cmd: CommandType;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const match = fuzzyMatch(
    document.querySelector<HTMLInputElement>('[data-command-input]')?.value || '',
    cmd.label,
  );
  const Icon = cmd.icon;

  return (
    <button
      data-index={index}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none transition-colors',
        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50',
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-left">
        {match ? highlightMatches(cmd.label, match.indices) : cmd.label}
      </span>
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
      navigate('/playground?template=readme-generator');
      break;
    case 'ai:gen-tests':
      navigate('/playground?template=generate-tests');
      break;
    case 'hist:continue':
      navigate('/history');
      break;
  }
}
