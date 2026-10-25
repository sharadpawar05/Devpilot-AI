import { useSearchParams } from 'react-router-dom';
import { User, Sparkles, Github, Palette, Bell, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSettings } from './ProfileSettings';
import { AIPreferencesSettings } from './AIPreferencesSettings';
import { GitHubSettings } from './GitHubSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { NotificationsSettings } from './NotificationsSettings';
import { SecuritySettings } from './SecuritySettings';
import { DangerZoneSettings } from './DangerZoneSettings';

export type SettingsSection =
  'profile' | 'ai' | 'github' | 'appearance' | 'notifications' | 'security' | 'danger';

const SECTION_KEYS = [
  'profile',
  'ai',
  'github',
  'appearance',
  'notifications',
  'security',
  'danger',
] as const;

function isSection(value: string): value is SettingsSection {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

const sections: { key: SettingsSection; label: string; icon: typeof User; danger?: boolean }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'ai', label: 'AI Preferences', icon: Sparkles },
  { key: 'github', label: 'GitHub', icon: Github },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
];

const sectionComponents: Record<SettingsSection, React.ComponentType> = {
  profile: ProfileSettings,
  ai: AIPreferencesSettings,
  github: GitHubSettings,
  appearance: AppearanceSettings,
  notifications: NotificationsSettings,
  security: SecuritySettings,
  danger: DangerZoneSettings,
};

export function SettingsLayout() {
  // Tab lives in the URL (?tab=profile) so it is shareable, back/forward
  // works, and a reload lands on the same section.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') ?? 'profile';
  const activeSection: SettingsSection = isSection(tabParam) ? tabParam : 'profile';
  const ActiveComponent = sectionComponents[activeSection];

  const setActiveSection = (section: SettingsSection) => {
    setSearchParams({ tab: section }, { replace: true });
  };

  return (
    <div className="flex h-full">
      <nav className="w-64 shrink-0 border-r border-input p-4">
        <h2 className="mb-4 px-3 text-lg font-semibold">Settings</h2>
        <div className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeSection === section.key
                  ? 'bg-primary/10 text-primary'
                  : section.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
