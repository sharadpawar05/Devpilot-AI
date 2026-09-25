import {
  useSettings,
  type DefaultReviewType,
  type DefaultReviewDepth,
} from '@/lib/settings-context';
import { Switch } from '@/components/ui/switch';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const;

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [{ value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' }],
  groq: [
    { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
    { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openrouter: [{ value: 'auto', label: 'Auto (Best Available)' }],
};

const REVIEW_TYPES = [
  { value: 'quick', label: 'Quick' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
];

const REVIEW_DEPTHS = [
  { value: 'shallow', label: 'Shallow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'thorough', label: 'Thorough' },
];

export function AIPreferencesSettings() {
  const { settings, updateAI } = useSettings();
  const models = MODELS[settings.ai.defaultProvider] || MODELS.gemini;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">AI Preferences</h2>
        <p className="text-sm text-muted-foreground">Configure your default AI settings.</p>
      </div>

      <div className="space-y-6">
        <Section title="Model Configuration">
          <Field label="Default Provider">
            <select
              value={settings.ai.defaultProvider}
              onChange={(e) => {
                const provider = e.target.value as typeof settings.ai.defaultProvider;
                const firstModel = MODELS[provider]?.[0]?.value || '';
                updateAI({ defaultProvider: provider, defaultModel: firstModel });
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default Model">
            <select
              value={settings.ai.defaultModel}
              onChange={(e) => updateAI({ defaultModel: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Temperature: ${settings.ai.temperature.toFixed(1)}`}>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.ai.temperature}
              onChange={(e) => updateAI({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </Field>

          <Field label="Max Tokens">
            <Input
              type="number"
              value={settings.ai.maxTokens}
              onChange={(e) => updateAI({ maxTokens: parseInt(e.target.value) || 4096 })}
              min={256}
              max={32768}
              step={256}
            />
          </Field>
        </Section>

        <Section title="Behavior">
          <ToggleField
            label="Stream Responses"
            description="Show AI responses as they're generated"
            checked={settings.ai.streamResponses}
            onChange={(v) => updateAI({ streamResponses: v })}
          />
          <ToggleField
            label="Markdown Output"
            description="Render AI responses as formatted markdown"
            checked={settings.ai.markdownOutput}
            onChange={(v) => updateAI({ markdownOutput: v })}
          />
          <ToggleField
            label="Auto Scroll"
            description="Automatically scroll to latest response"
            checked={settings.ai.autoScroll}
            onChange={(v) => updateAI({ autoScroll: v })}
          />
          <ToggleField
            label="Auto Copy"
            description="Automatically copy AI responses to clipboard"
            checked={settings.ai.autoCopy}
            onChange={(v) => updateAI({ autoCopy: v })}
          />
        </Section>

        <Section title="Defaults">
          <Field label="Default Review Type">
            <div className="flex gap-2">
              {REVIEW_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => updateAI({ defaultReviewType: rt.value as DefaultReviewType })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    settings.ai.defaultReviewType === rt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Default Review Depth">
            <div className="flex gap-2">
              {REVIEW_DEPTHS.map((rd) => (
                <button
                  key={rd.value}
                  onClick={() => updateAI({ defaultReviewDepth: rd.value as DefaultReviewDepth })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    settings.ai.defaultReviewDepth === rd.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {rd.label}
                </button>
              ))}
            </div>
          </Field>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary ${className || ''}`}
      {...props}
    />
  );
}
