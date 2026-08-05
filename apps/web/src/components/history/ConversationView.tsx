import { ArrowLeft, Copy, Check, User, Bot, Clock, Zap, Coins } from 'lucide-react';
import { useState } from 'react';
import type { AIHistorySession } from '@devpilot/types';
import { WORKFLOW_TYPE_LABELS } from '@devpilot/types';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { cn } from '@/lib/utils';

interface ConversationViewProps {
  session: AIHistorySession;
  onBack: () => void;
  onContinue: (session: AIHistorySession) => void;
}

export function ConversationView({ session, onBack, onContinue }: ConversationViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-input p-4">
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="truncate text-lg font-semibold">{session.title}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{WORKFLOW_TYPE_LABELS[session.workflowType]}</span>
            {session.repository && (
              <>
                <span>·</span>
                <span>{session.repository}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onContinue(session)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-input px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatDate(session.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          <span>{formatLatency(session.totalLatency)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="h-3 w-3" />
          <span>{session.totalTokens.toLocaleString()} tokens</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5">
          {session.provider} / {session.model}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {session.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'group relative rounded-xl border p-4',
                message.role === 'user' ? 'border-primary/30 bg-primary/5' : 'border-input bg-card',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{message.role === 'user' ? 'You' : 'AI'}</span>
                    <span>·</span>
                    <span>{formatDate(message.timestamp)}</span>
                    <span>·</span>
                    <span>{formatLatency(message.latency)}</span>
                    <span>·</span>
                    <span>{message.tokens.toLocaleString()} tokens</span>
                  </div>
                  <MarkdownRenderer content={message.content} />
                </div>
                <button
                  onClick={() => copyToClipboard(message.content, message.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedId === message.id ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
