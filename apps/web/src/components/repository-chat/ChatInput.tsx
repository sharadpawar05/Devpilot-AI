import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const selectClass =
  'rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  ],
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
  const [model, setModel] = useState('gemini-3.5-flash');

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
    <div className="border-t border-input p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className={selectClass}
        >
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
          {availableModels.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <Button onClick={handleSend} disabled={!input.trim() || disabled} size="icon">
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
