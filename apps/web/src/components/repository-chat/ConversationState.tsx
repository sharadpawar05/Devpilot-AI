import { useState, useRef, useEffect } from 'react';
import { Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatMessage as ChatMessageType } from '@/hooks/use-repository-chat';

interface ConversationStateProps {
  messages: ChatMessageType[];
  isChatting: boolean;
  onSend: (question: string, provider: string) => void;
  onClear: () => void;
  onFileClick?: (path: string) => void;
}

export function ConversationState({
  messages,
  isChatting,
  onSend,
  onClear,
  onFileClick,
}: ConversationStateProps) {
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-input px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Chat</h3>
          <span className="text-xs text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleCopyAll} title="Copy all">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClear} title="Clear chat">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
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
          />
        ))}
        {isChatting && (
          <div className="flex justify-start mb-4">
            <div className="rounded-xl border border-input bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isChatting} placeholder="Ask a follow-up..." />
    </div>
  );
}
