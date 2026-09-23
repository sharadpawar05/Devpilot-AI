import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Trash2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  FolderTree,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/hooks/use-repository-chat';

interface ConversationStateProps {
  messages: ChatMessageType[];
  isChatting: boolean;
  onSend: (question: string, provider: string, model: string) => void;
  onClear: () => void;
  onFileClick?: (path: string) => void;
  error?: string | null;
  onRetry?: () => void;
}

interface MessageGroup {
  id: string;
  files: string[];
  messages: ChatMessageType[];
}

/** Group messages into turns: each user message starts a group; following assistant replies join it. */
function groupMessages(messages: ChatMessageType[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of messages) {
    if (msg.role === 'user' || groups.length === 0) {
      groups.push({ id: msg.id, files: [], messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
    const g = groups[groups.length - 1];
    if (msg.referencedFiles?.length) {
      g.files = [...new Set([...g.files, ...msg.referencedFiles])];
    }
  }
  return groups;
}

function shortLabel(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join('/')}`;
}

export function ConversationState({
  messages,
  isChatting,
  onSend,
  onClear,
  onFileClick,
  error,
  onRetry,
}: ConversationStateProps) {
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyAll = () => {
    const text = messages
      .map((m) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-input bg-card/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Chat</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {messages?.length ?? 0} message{(messages?.length ?? 0) !== 1 ? 's' : ''}
            {groups.length > 1 ? ` · ${groups.length} threads` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyAll}
            title="Copy all"
            aria-label="Copy all messages"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {(messages?.length ?? 0) === 0 && !isChatting && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium">Start the conversation</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Ask anything about this repository — architecture, bugs, or how things work.
            </p>
          </div>
        )}

        {groups.map((group, gi) => {
          const hasContext = group.files.length > 0;
          const isLastGroup = gi === groups.length - 1;

          return (
            <div key={group.id} className="mb-5" data-testid="message-group">
              {hasContext && (
                <div
                  className="mb-2 flex flex-wrap items-center gap-1.5 px-1"
                  role="group"
                  aria-label="Message context files"
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <FolderTree className="h-3 w-3" aria-hidden />
                    Context
                  </span>
                  {group.files.slice(0, 4).map((file) => (
                    <button
                      key={file}
                      type="button"
                      onClick={() => onFileClick?.(file)}
                      className="cite-btn"
                      aria-label={`Open context file ${file}`}
                      title={file}
                    >
                      <span className="cite-label">{shortLabel(file)}</span>
                    </button>
                  ))}
                  {group.files.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{group.files.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div
                className={cn(
                  'space-y-1 rounded-2xl p-2 transition-colors',
                  hasContext
                    ? 'border border-primary/15 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent'
                    : group.messages.length > 1
                      ? 'border border-input/40 bg-muted/20'
                      : 'border border-transparent',
                  isLastGroup && 'animate-fade-in',
                )}
              >
                {group.messages.map((msg, mi) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    provider={msg.provider}
                    model={msg.model}
                    latencyMs={msg.latencyMs}
                    usage={msg.usage}
                    referencedFiles={msg.referencedFiles}
                    onFileClick={onFileClick}
                    grouped={group.messages.length > 1}
                    animationDelay={Math.min(mi * 60, 240)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {isChatting && (
          <div
            className="mb-4 flex animate-message-in justify-start"
            role="status"
            aria-label="Assistant is thinking"
          >
            <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-input gradient-assistant px-4 py-3 shadow-sm">
              <div className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </div>
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && !isChatting && (
        <div
          className="mx-4 mb-3 flex animate-slide-up items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
              aria-label="Retry last message"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" aria-hidden />
              Retry
            </Button>
          )}
        </div>
      )}

      <ChatInput onSend={onSend} disabled={isChatting} placeholder="Ask a follow-up..." />
    </div>
  );
}
