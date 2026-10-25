import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Monitor, Save, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { applyAppearance, type Appearance } from '@/lib/appearance';
import {
  useSettingsQuery,
  useUpdateAppearance,
  type ThemePreference,
  type FontSize,
  type AccentColor,
} from '@/hooks/use-settings';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const FONT_SIZES: { value: FontSize; label: string; preview: string }[] = [
  { value: 'small', label: 'Small', preview: 'text-xs' },
  { value: 'default', label: 'Default', preview: 'text-sm' },
  { value: 'large', label: 'Large', preview: 'text-base' },
];

const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
  { value: 'green', label: 'Green', color: 'bg-emerald-500' },
  { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', color: 'bg-pink-500' },
];

export function AppearanceSettings() {
  const { data, isLoading } = useSettingsQuery();
  const updateAppearance = useUpdateAppearance();
  const { setTheme } = useTheme();
  const { addToast } = useToast();

  const saved: Appearance | undefined = data?.appearance;
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the saved server values once.
  useEffect(() => {
    if (data?.appearance && !seeded) {
      setDraft(data.appearance);
      setSeeded(true);
    }
  }, [data, seeded]);

  // Live preview: apply draft choices as they change (theme flows through
  // ThemeProvider; the rest are document attributes).
  useEffect(() => {
    if (!draft) return;
    setTheme(draft.theme);
    applyAppearance(draft);
  }, [draft, setTheme]);

  // Keep the latest persisted values so an unsaved preview can be reverted.
  const persistedRef = useRef<Appearance | undefined>(undefined);
  useEffect(() => {
    persistedRef.current = saved;
  });

  // Revert to persisted values when the tab unmounts without saving, so the
  // document never drifts from what the server actually stores.
  useEffect(() => {
    return () => {
      const persisted = persistedRef.current;
      if (persisted) {
        setTheme(persisted.theme);
        applyAppearance(persisted);
      }
    };
  }, [setTheme]);

  if (isLoading || !data || !draft) {
    return <AppearanceSkeleton />;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = updateAppearance.isPending;

  const handleSave = async () => {
    setError(null);
    try {
      await updateAppearance.mutateAsync(draft);
      addToast('Appearance preferences saved', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save appearance preferences');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize how DevPilot looks.</p>
      </div>

      <div className="space-y-6">
        <Section title="Theme">
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setDraft({ ...draft, theme: t.value })}
                disabled={saving}
                aria-pressed={draft.theme === t.value}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:opacity-50',
                  draft.theme === t.value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:border-primary/30',
                )}
              >
                <t.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Layout">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact Mode</p>
              <p className="text-xs text-muted-foreground">Reduce spacing for a denser layout</p>
            </div>
            <Switch
              aria-label="Compact mode"
              checked={draft.compactMode}
              disabled={saving}
              onCheckedChange={(v) => setDraft({ ...draft, compactMode: v })}
            />
          </div>
        </Section>

        <Section title="Font Size">
          <div className="flex gap-3">
            {FONT_SIZES.map((fs) => (
              <button
                key={fs.value}
                type="button"
                onClick={() => setDraft({ ...draft, fontSize: fs.value })}
                disabled={saving}
                aria-pressed={draft.fontSize === fs.value}
                className={cn(
                  'flex-1 rounded-xl border-2 p-3 text-center transition-all disabled:opacity-50',
                  draft.fontSize === fs.value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:border-primary/30',
                )}
              >
                <span className={cn('font-medium', fs.preview)}>{fs.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Accent Color">
          <div className="flex gap-3">
            {ACCENT_COLORS.map((ac) => (
              <button
                key={ac.value}
                type="button"
                onClick={() => setDraft({ ...draft, accentColor: ac.value })}
                disabled={saving}
                aria-label={ac.label}
                aria-pressed={draft.accentColor === ac.value}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:opacity-50',
                  ac.color,
                  draft.accentColor === ac.value
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'hover:scale-110',
                )}
              >
                {draft.accentColor === ac.value && (
                  <span className="h-3 w-3 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Appearance
            </>
          )}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function AppearanceSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
