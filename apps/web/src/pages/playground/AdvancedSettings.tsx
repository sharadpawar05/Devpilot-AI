import { useState } from 'react';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const;

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-flash-latest', label: 'Gemini Flash (Latest)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  ],
  openrouter: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  ],
};

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface AdvancedSettingsProps {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temp: number) => void;
  onMaxTokensChange: (tokens: number) => void;
}

export function AdvancedSettings({
  provider,
  model,
  temperature,
  maxTokens,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
}: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableModels = MODELS[provider] ?? MODELS.gemini;

  function handleProviderChange(newProvider: string) {
    onProviderChange(newProvider);
    const models = MODELS[newProvider];
    if (models?.length) onModelChange(models[0].value);
  }

  return (
    <div className="rounded-md border border-input">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Settings className="h-3.5 w-3.5" />
          Advanced Settings
        </span>
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-input px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="provider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className={selectClass}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="model" className="text-sm font-medium">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className={selectClass}
              >
                {availableModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="temperature" className="text-sm font-medium">
                  Temperature
                </label>
                <span className="text-xs text-muted-foreground">{temperature}</span>
              </div>
              <input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => onTemperatureChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="maxTokens" className="text-sm font-medium">
                Max Tokens
              </label>
              <input
                id="maxTokens"
                type="number"
                min="256"
                max="100000"
                step="256"
                value={maxTokens}
                onChange={(e) => onMaxTokensChange(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PROVIDERS, MODELS };
