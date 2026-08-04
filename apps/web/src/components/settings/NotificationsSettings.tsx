import { Bell } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import { Switch } from '@/components/ui/switch';

const NOTIFICATION_ITEMS = [
  {
    key: 'reviewComplete' as const,
    label: 'Review Complete',
    description: 'Get notified when an AI code review finishes',
  },
  {
    key: 'prAnalysis' as const,
    label: 'PR Analysis',
    description: 'Get notified when a PR analysis is ready',
  },
  {
    key: 'repositorySync' as const,
    label: 'Repository Sync',
    description: 'Get notified when repository data is synced',
  },
  {
    key: 'githubAlerts' as const,
    label: 'GitHub Alerts',
    description: 'Get notified about GitHub activity on your repos',
  },
  {
    key: 'weeklySummary' as const,
    label: 'Weekly Summary',
    description: 'Receive a weekly digest of your AI usage',
  },
];

export function NotificationsSettings() {
  const { settings, updateNotifications } = useSettings();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">Choose what notifications you receive.</p>
      </div>

      <div className="rounded-xl border border-input bg-card p-5">
        <div className="space-y-4">
          {NOTIFICATION_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Switch
                checked={settings.notifications[item.key]}
                onCheckedChange={(v) => updateNotifications({ [item.key]: v })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
