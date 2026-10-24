import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Save, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSettingsQuery,
  useUpdateProfile,
  useUploadAvatar,
  useDeleteAvatar,
  type SettingsData,
} from '@/hooks/use-settings';

// Full IANA list from the runtime. Browsers can report a legacy alias (e.g.
// Asia/Calcutta) that is absent from some server/client lists, so we union the
// browser's resolved zone into the options below and always render the current
// value as an option — a controlled <select> silently falls back to the first
// option when its value is missing, which is the root cause of the old
// "timezone resets to America/New_York" bug.
function useTimezoneOptions(): string[] {
  return useMemo(() => {
    const base =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const set = new Set<string>(base);
    if (browserTz) set.add(browserTz);
    // Always allow UTC explicitly.
    set.add('UTC');
    return Array.from(set).sort();
  }, []);
}

interface ProfileForm {
  name: string;
  timezone: string;
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// True when the form matches the last server-saved values.
function isClean(form: ProfileForm, saved: SettingsData['profile']): boolean {
  return form.name === saved.name && form.timezone === saved.timezone;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function ProfileSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { data, isLoading } = useSettingsQuery();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timezones = useTimezoneOptions();

  const [form, setForm] = useState<ProfileForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form once the server data arrives. The schema default timezone is
  // 'UTC' (never customized); suggest the browser zone so a fresh user gets
  // their real timezone — the form is dirty so they just click Save.
  useEffect(() => {
    if (data && form === null) {
      const savedTz = data.profile.timezone;
      const bz = browserTimezone();
      const tz = savedTz === 'UTC' ? bz : savedTz;
      const seeded = { name: data.profile.name, timezone: tz };
      setForm(seeded);
      setDirty(!isClean(seeded, data.profile));
    }
  }, [data, form]);

  if (isLoading || !data || !form) {
    return <ProfileSkeleton />;
  }

  const avatarUrl = data.profile.avatarUrl || user?.avatarUrl || null;

  const handleChange = (patch: Partial<ProfileForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setDirty(!isClean(next, data.profile));
  };

  const handleSave = async () => {
    setError(null);
    try {
      await updateProfile.mutateAsync({ name: form.name, timezone: form.timezone });
      addToast('Profile saved', 'success');
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Please choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image must be under 2MB.');
      return;
    }
    setError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
    try {
      await uploadAvatar.mutateAsync(dataUrl);
      addToast('Avatar updated', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    }
  };

  const handleRemoveAvatar = async () => {
    setError(null);
    try {
      await deleteAvatar.mutateAsync();
      addToast('Avatar removed', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar');
    }
  };

  const saving = updateProfile.isPending || uploadAvatar.isPending || deleteAvatar.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your personal information.</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
              {form.name?.[0] || user?.name?.[0] || '?'}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            aria-label="Change avatar"
            className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{form.name || 'User'}</p>
          <p className="text-xs text-muted-foreground">{data.profile.email}</p>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Remove avatar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Full Name" htmlFor="profile-name">
          <Input
            id="profile-name"
            value={form.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder={user?.name || 'Your name'}
            disabled={saving}
          />
        </Field>

        <Field label="Email" htmlFor="profile-email">
          <Input id="profile-email" value={data.profile.email} type="email" disabled readOnly />
          <p className="mt-1 text-xs text-muted-foreground">
            Your email is provided by your sign-in provider and cannot be changed here.
          </p>
        </Field>

        <Field label="Timezone" htmlFor="profile-timezone">
          <select
            id="profile-timezone"
            value={form.timezone}
            onChange={(e) => handleChange({ timezone: e.target.value })}
            disabled={saving}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {/* Always include the current value even if absent from the list. */}
            {!timezones.includes(form.timezone) && (
              <option value={form.timezone}>{form.timezone.replace(/_/g, ' ')}</option>
            )}
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          {saving ? (
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

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
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
