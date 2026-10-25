import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  useSettingsQuery,
  useUpdateAI,
  type SettingsData,
  type AIProvider,
  type DefaultReviewType,
  type DefaultReviewDepth,
} from '@/hooks/use-settings';

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
];

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

const REVIEW_TYPES: { value: DefaultReviewType; label: string }[] = [
  { value: 'quick', label: 'Quick' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
];

const REVIEW_DEPTHS: { value: DefaultReviewDepth; label: string }[] = [
  { value: 'shallow', label: 'Shallow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'thorough', label: 'Thorough' },
];

type AIPrefs = SettingsData['ai'];

function sameAI(a: AIPrefs, b: AIPrefs): boolean {
  return (
    a.defaultProvider === b.defaultProvider &&
    a.defaultModel === b.defaultModel &&
    a.temperature === b.temperature &&
    a.maxTokens === b.maxTokens &&
    a.streamResponses === b.streamResponses &&
    a.markdownOutput === b.markdownOutput &&
    a.autoScroll === b.autoScroll &&
    a.autoCopy === b.autoCopy &&
    a.defaultReviewType === b.defaultReviewType &&
    a.defaultReviewDepth === b.defaultReviewDepth
  );
}

export function AIPreferencesSettings() {
  const { data, isLoading } = useSettingsQuery();
  const updateAI = useUpdateAI();
  const { addToast } = useToast();

  const [form, setForm] = useState<AIPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && form === null) {
      setForm(data.ai);
    }
  }, [data, form]);

  if (isLoading || !data || !form) {
    return <AISkeleton />;
  }

  const models = MODELS[form.defaultProvider] ?? MODELS.gemini;
  const dirty = !sameAI(form, data.ai);

  const handleChange = (patch: Partial<AIPrefs>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleProviderChange = (provider: AIProvider) => {
    const firstModel = MODELS[provider]?.[0]?.value ?? '';
    setForm((prev) =>
      prev ? { ...prev, defaultProvider: provider, defaultModel: firstModel } : prev,
    );
  };

  const handleSave = async () => {
    setError(null);
    try {
      await updateAI.mutateAsync(form);
      addToast('AI preferences saved', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI preferences');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">AI Preferences</h2>
        <p className="text-sm text-muted-foreground">Configure your default AI settings.</p>
      </div>

      <div className="space-y-6">
        <Section title="Model Configuration">
          <Field label="Default Provider" htmlFor="ai-provider">
            <select
              id="ai-provider"
              value={form.defaultProvider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className={selectCls}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default Model" htmlFor="ai-model">
            <select
              id="ai-model"
              value={form.defaultModel}
              onChange={(e) => handleChange({ defaultModel: e.target.value })}
              className={selectCls}
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Temperature: ${form.temperature.toFixed(1)}`}>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => handleChange({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </Field>

          <Field label="Max Tokens" htmlFor="ai-max-tokens">
            <input
              id="ai-max-tokens"
              type="number"
              value={form.maxTokens}
              onChange={(e) => handleChange({ maxTokens: parseInt(e.target.value) || 4096 })}
              min={256}
              max={32768}
              step={256}
              className={selectCls}
            />
          </Field>
        </Section>

        <Section title="Behavior">
          <ToggleField
            label="Stream Responses"
            description="Show AI responses as they're generated"
            checked={form.streamResponses}
            onChange={(v) => handleChange({ streamResponses: v })}
          />
          <ToggleField
            label="Markdown Output"
            description="Render AI responses as formatted markdown"
            checked={form.markdownOutput}
            onChange={(v) => handleChange({ markdownOutput: v })}
          />
          <ToggleField
            label="Auto Scroll"
            description="Automatically scroll to latest response"
            checked={form.autoScroll}
            onChange={(v) => handleChange({ autoScroll: v })}
          />
          <ToggleField
            label="Auto Copy"
            description="Automatically copy AI responses to clipboard"
            checked={form.autoCopy}
            onChange={(v) => handleChange({ autoCopy: v })}
          />
        </Section>

        <Section title="Defaults">
          <Field label="Default Review Type">
            <div className="flex gap-2">
              {REVIEW_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => handleChange({ defaultReviewType: rt.value })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    form.defaultReviewType === rt.value
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
                  type="button"
                  onClick={() => handleChange({ defaultReviewDepth: rd.value })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    form.defaultReviewDepth === rd.value
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateAI.isPending || !dirty} className="gap-2">
          {updateAI.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const selectCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
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

function AISkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
