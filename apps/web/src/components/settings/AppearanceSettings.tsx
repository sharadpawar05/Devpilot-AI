import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import {
  useSettings,
  type ThemePreference,
  type FontSize,
  type AccentColor,
} from '@/lib/settings-context';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
  const { theme, setTheme } = useTheme();
  const { settings, updateAppearance } = useSettings();

  const handleThemeChange = (t: ThemePreference) => {
    setTheme(t);
    updateAppearance({ theme: t });
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
                onClick={() => handleThemeChange(t.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  theme === t.value
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
              checked={settings.appearance.compactMode}
              onCheckedChange={(v) => updateAppearance({ compactMode: v })}
            />
          </div>
        </Section>

        <Section title="Font Size">
          <div className="flex gap-3">
            {FONT_SIZES.map((fs) => (
              <button
                key={fs.value}
                onClick={() => updateAppearance({ fontSize: fs.value })}
                className={cn(
                  'flex-1 rounded-xl border-2 p-3 text-center transition-all',
                  settings.appearance.fontSize === fs.value
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
                onClick={() => updateAppearance({ accentColor: ac.value })}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                  ac.color,
                  settings.appearance.accentColor === ac.value
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'hover:scale-110',
                )}
                title={ac.label}
              >
                {settings.appearance.accentColor === ac.value && (
                  <span className="h-3 w-3 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </Section>
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
