import {
  Star,
  Pin,
  Archive,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  FileCode,
  GitPullRequest,
  BookOpen,
  FlaskConical,
  Folder,
} from 'lucide-react';
import type { AIHistorySessionMetadata, WorkflowType } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

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

interface HistoryCardProps {
  session: AIHistorySessionMetadata;
  onSelect: (session: AIHistorySessionMetadata) => void;
  onContinue: (session: AIHistorySessionMetadata) => void;
  onTogglePin: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function HistoryCard({
  session,
  onSelect,
  onContinue,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  onRename,
}: HistoryCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = workflowIcons[session.workflowType] || MessageSquare;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(session.id, editTitle.trim());
    } else {
      setEditTitle(session.title);
    }
    setIsEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-input bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30',
        session.pinned && 'border-l-2 border-l-primary',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') {
                    setEditTitle(session.title);
                    setIsEditing(false);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none border-b border-primary"
              />
            ) : (
              <button
                onClick={() => onSelect(session)}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary transition-colors"
              >
                {session.title}
              </button>
            )}
            {session.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
            {session.favorite && (
              <Star className="h-3 w-3 shrink-0 fill-yellow-500 text-yellow-500" />
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">
              {WORKFLOW_TYPE_LABELS[session.workflowType]}
            </span>
            {session.repository && (
              <>
                <span>·</span>
                <span className="truncate">{session.repository}</span>
              </>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatDate(session.updatedAt)}</span>
            <span>·</span>
            <span>{session.messageCount} messages</span>
            <span>·</span>
            <span>{formatLatency(session.totalLatency)}</span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-input bg-card py-1 shadow-lg">
              <button
                onClick={() => {
                  onContinue(session);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <MessageSquare className="h-4 w-4" />
                Continue conversation
              </button>
              <button
                onClick={() => {
                  setIsEditing(true);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <FileCode className="h-4 w-4" />
                Rename
              </button>
              <button
                onClick={() => {
                  onTogglePin(session.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Pin className="h-4 w-4" />
                {session.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={() => {
                  onToggleFavorite(session.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Star className="h-4 w-4" />
                {session.favorite ? 'Remove from favorites' : 'Add to favorites'}
              </button>
              <button
                onClick={() => {
                  onToggleArchive(session.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Archive className="h-4 w-4" />
                {session.archived ? 'Unarchive' : 'Archive'}
              </button>
              <div className="my-1 border-t border-input" />
              <button
                onClick={() => {
                  if (confirm('Delete this session? This cannot be undone.')) {
                    onDelete(session.id);
                  }
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
