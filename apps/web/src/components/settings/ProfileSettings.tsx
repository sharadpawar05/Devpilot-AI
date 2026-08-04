import { useState } from 'react';
import { Camera, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/auth';
import { useSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function ProfileSettings() {
  const { user } = useAuth();
  const { settings, updateProfile } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your personal information.</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          {settings.profile.avatarUrl || user?.avatarUrl ? (
            <img
              src={settings.profile.avatarUrl || user?.avatarUrl}
              alt="Avatar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
              {settings.profile.name?.[0] || user?.name?.[0] || '?'}
            </div>
          )}
          <button className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90 transition-colors">
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium">{user?.name || 'User'}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Full Name">
          <Input
            value={settings.profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
            placeholder={user?.name || 'Your name'}
          />
        </Field>

        <Field label="Email">
          <Input
            value={settings.profile.email}
            onChange={(e) => updateProfile({ email: e.target.value })}
            placeholder={user?.email || 'your@email.com'}
            type="email"
          />
        </Field>

        <Field label="Timezone">
          <select
            value={settings.profile.timezone}
            onChange={(e) => updateProfile({ timezone: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            'Saved!'
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
