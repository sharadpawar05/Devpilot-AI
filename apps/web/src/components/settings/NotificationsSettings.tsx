import { useEffect, useState } from 'react';
import { Bell, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  useSettingsQuery,
  useUpdateNotifications,
  type NotificationsPatch,
} from '@/hooks/use-settings';

const NOTIFICATION_ITEMS: {
  key: keyof NotificationsPatch;
  label: string;
  description: string;
}[] = [
  {
    key: 'notifyReviewComplete',
    label: 'Review Complete',
    description: 'Get notified when an AI code review finishes',
  },
  {
    key: 'notifyPrAnalysis',
    label: 'PR Analysis',
    description: 'Get notified when a PR analysis is ready',
  },
  {
    key: 'notifyRepositorySync',
    label: 'Repository Sync',
    description: 'Get notified when repository data is synced',
  },
  {
    key: 'notifyGithubAlerts',
    label: 'GitHub Alerts',
    description: 'Get notified about GitHub activity on your repos',
  },
  {
    key: 'notifyWeeklySummary',
    label: 'Weekly Summary',
    description: 'Receive a weekly digest of your AI usage',
  },
];

export function NotificationsSettings() {
  const { data, isLoading } = useSettingsQuery();
  const updateNotifications = useUpdateNotifications();
  const { addToast } = useToast();

  const saved: NotificationsPatch | undefined = data?.notifications;
  const [draft, setDraft] = useState<NotificationsPatch | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the saved server values once.
  useEffect(() => {
    if (data?.notifications && !seeded) {
      setDraft(data.notifications);
      setSeeded(true);
    }
  }, [data, seeded]);

  if (isLoading || !data || !draft) {
    return <NotificationsSkeleton />;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = updateNotifications.isPending;

  const handleSave = async () => {
    setError(null);
    try {
      await updateNotifications.mutateAsync(draft);
      addToast('Notification preferences saved', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification preferences');
    }
  };

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
                aria-label={item.label}
                checked={draft[item.key]}
                disabled={saving}
                onCheckedChange={(v) => setDraft({ ...draft, [item.key]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
