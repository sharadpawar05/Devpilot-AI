import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const selectClass =
  'rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  gemini: [{ value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' }],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  ],
  openrouter: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  ],
};

interface ChatInputProps {
  onSend: (question: string, provider: string, model: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about this repository...',
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-3.6-flash');

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const models = MODELS_BY_PROVIDER[newProvider];
    if (models?.length) {
      setModel(models[0].value);
    }
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim(), provider, model);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const availableModels = MODELS_BY_PROVIDER[provider] || [];

  return (
    <div className="shrink-0 border-t border-input bg-card/60 p-3 backdrop-blur sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <label htmlFor="chat-message-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-message-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label="Message"
            className={cn(
              'min-h-[44px] flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-all duration-150',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50',
            )}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            size="icon"
            aria-label="Send message"
            className="shrink-0 rounded-xl"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="chat-provider-select" className="sr-only">
            AI provider
          </label>
          <select
            id="chat-provider-select"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            aria-label="AI provider"
            className={cn(selectClass, 'min-h-[40px] flex-1 sm:flex-none')}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <label htmlFor="chat-model-select" className="sr-only">
            AI model
          </label>
          <select
            id="chat-model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="AI model"
            className={cn(selectClass, 'min-h-[40px] flex-1 sm:flex-none')}
          >
            {availableModels.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">
        Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> to send
      </p>
    </div>
  );
}
