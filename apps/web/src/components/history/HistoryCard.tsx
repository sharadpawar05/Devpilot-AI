import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Star,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  FileCode,
  GitPullRequest,
  BookOpen,
  FlaskConical,
  Folder,
  Copy,
  RotateCcw,
  ExternalLink,
  Check,
  Coins,
  Clock,
  Zap,
  Square,
  CheckSquare,
} from 'lucide-react';
import type { AIHistorySessionMetadata, WorkflowType } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatLatency, formatTokens } from '@/lib/history-utils';

const workflowIcons: Record<WorkflowType, typeof MessageSquare> = {
  playground: MessageSquare,
  'code-review': FileCode,
  'pr-review': GitPullRequest,
  'pr-analysis': GitPullRequest,
  'repository-chat': Folder,
  documentation: BookOpen,
  'test-generation': FlaskConical,
  'security-review': Folder,
  'architecture-review': Folder,
};

const workflowColors: Record<WorkflowType, string> = {
  playground: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  'code-review': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'pr-review': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'pr-analysis': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'repository-chat': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  documentation: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'test-generation': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'security-review': 'bg-red-500/10 text-red-600 dark:text-red-400',
  'architecture-review': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

interface HistoryCardProps {
  session: AIHistorySessionMetadata;
  onSelect: (session: AIHistorySessionMetadata) => void;
  onContinue: (session: AIHistorySessionMetadata) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (session: AIHistorySessionMetadata) => void;
  onCopyPrompt?: (session: AIHistorySessionMetadata) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const HistoryCard = memo(function HistoryCard({
  session,
  onSelect,
  onContinue,
  onToggleFavorite,
  onDelete,
  onDuplicate,
  onCopyPrompt,
  selected,
  onToggleSelect,
}: HistoryCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const Icon = workflowIcons[session.workflowType as WorkflowType] || MessageSquare;
  const colorClass =
    workflowColors[session.workflowType as WorkflowType] || 'bg-gray-500/10 text-gray-600';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPrompt = useCallback(async () => {
    if (onCopyPrompt) {
      onCopyPrompt(session);
    } else {
      await navigator.clipboard.writeText(session.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [session, onCopyPrompt]);

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-4 shadow-sm transition-all duration-200',
        'hover:shadow-md hover:border-primary/20',
        selected && 'border-primary bg-primary/5',
        session.pinned && 'border-l-2 border-l-primary',
      )}
    >
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <button
            onClick={() => onToggleSelect(session.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {selected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        )}

        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            colorClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(session)}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-primary transition-colors"
            >
              {session.title}
            </button>
            {session.favorite && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                colorClass,
              )}
            >
              {WORKFLOW_TYPE_LABELS[session.workflowType as WorkflowType]}
            </span>
            {session.repository && (
              <span className="flex items-center gap-1 truncate">
                <Folder className="h-3 w-3 shrink-0" />
                {session.repository}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {session.provider}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {formatTokens(session.totalTokens)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLatency(session.totalLatency)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {session.messageCount}
            </span>
            <span>{formatRelativeTime(session.updatedAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onToggleFavorite(session.id)}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              session.favorite
                ? 'text-yellow-500 hover:bg-yellow-500/10'
                : 'text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-muted',
            )}
            title={session.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('h-4 w-4', session.favorite && 'fill-current')} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-muted transition-all"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-input bg-card py-1 shadow-xl">
                <MenuButton
                  icon={ExternalLink}
                  label="Open"
                  onClick={() => {
                    onSelect(session);
                    setShowMenu(false);
                  }}
                />
                {session.workflowType !== 'playground' && (
                  <MenuButton
                    icon={RotateCcw}
                    label="Continue session"
                    onClick={() => {
                      onContinue(session);
                      setShowMenu(false);
                    }}
                  />
                )}
                {onDuplicate && (
                  <MenuButton
                    icon={Copy}
                    label="Duplicate"
                    onClick={() => {
                      onDuplicate(session);
                      setShowMenu(false);
                    }}
                  />
                )}
                <MenuButton
                  icon={copied ? Check : Copy}
                  label={copied ? 'Copied!' : 'Copy prompt'}
                  onClick={() => {
                    handleCopyPrompt();
                    setShowMenu(false);
                  }}
                />
                <div className="my-1 border-t border-border/50" />
                <MenuButton
                  icon={Star}
                  label={session.favorite ? 'Unfavorite' : 'Favorite'}
                  onClick={() => {
                    onToggleFavorite(session.id);
                    setShowMenu(false);
                  }}
                />
                <MenuButton
                  icon={Trash2}
                  label="Delete"
                  onClick={() => {
                    onDelete(session.id);
                    setShowMenu(false);
                  }}
                  destructive
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted',
        destructive ? 'text-destructive' : 'text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
