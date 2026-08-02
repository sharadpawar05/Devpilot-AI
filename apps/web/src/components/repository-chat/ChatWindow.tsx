import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';
import type { ChatMessage as ChatMessageType } from '@/hooks/use-repository-chat';

const selectClass =
  'rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface ChatWindowProps {
  messages: ChatMessageType[];
  isChatting: boolean;
  isIndexed: boolean;
  onSend: (question: string, provider: string, model?: string) => void;
  onClear: () => void;
  onFileClick?: (path: string) => void;
}

export function ChatWindow({
  messages,
  isChatting,
  isIndexed,
  onSend,
  onClear,
  onFileClick,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isChatting) return;
    onSend(input.trim(), provider);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyAll = () => {
    const text = messages
      .map((m) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-input px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Chat</h3>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={selectClass}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="icon" onClick={handleCopyAll} title="Copy all">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClear} title="Clear chat">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mx-auto max-w-md text-center">
              <h4 className="text-lg font-semibold">Repository AI Chat</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask questions about your repository. The AI will analyze the code structure,
                configuration, and relevant files to provide contextual answers.
              </p>
              {isIndexed && (
                <div className="mt-6">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Suggested Questions
                  </p>
                  <SuggestedQuestions onSelect={(q) => onSend(q, provider)} disabled={isChatting} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
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
        )}
      </div>

      <div className="border-t border-input p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isIndexed ? 'Ask about this repository...' : 'Index the repository first'}
            disabled={!isIndexed || isChatting}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isChatting || !isIndexed}
            size="icon"
          >
            {isChatting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
