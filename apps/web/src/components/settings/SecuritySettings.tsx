import { useState } from 'react';
import { Monitor, LogOut, Key, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  useAccountSessions,
  useRevokeOtherSessions,
  type AccountSession,
} from '@/hooks/use-settings';
import { formatRelativeTime } from '@/hooks/use-notifications';

export function SecuritySettings() {
  const { addToast } = useToast();
  const sessionsQuery = useAccountSessions();
  const revokeOthers = useRevokeOtherSessions();
  const [error, setError] = useState<string | null>(null);

  const data = sessionsQuery.data;
  const sessions = data?.sessions ?? [];
  const sorted = [...sessions].sort((a, b) => Number(b.current) - Number(a.current));
  const otherCount = sessions.filter((s) => !s.current).length;

  const handleRevokeOthers = async () => {
    setError(null);
    try {
      const revoked = await revokeOthers.mutateAsync();
      addToast(`Signed out ${revoked} other session${revoked === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out other sessions');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage your active sessions. Sign-in is handled by Google or GitHub.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Active Sessions">
          {sessionsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-20 w-full rounded-xl" />
              <div className="skeleton h-20 w-full rounded-xl" />
            </div>
          ) : sessionsQuery.error && !data ? (
            <p className="text-sm text-destructive">Couldn&apos;t load your sessions.</p>
          ) : data && !data.supported ? (
            <p className="text-sm text-muted-foreground">
              Session management isn&apos;t available for your sign-in method.
            </p>
          ) : data ? (
            <div className="space-y-3">
              {sorted.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {otherCount > 0 ? (
                <Button
                  variant="outline"
                  onClick={handleRevokeOthers}
                  disabled={revokeOthers.isPending}
                  className="gap-2 text-destructive hover:border-destructive/40 hover:text-destructive"
                >
                  {revokeOthers.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Sign Out Other Sessions ({otherCount})
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">No other active sessions.</p>
              )}
            </div>
          ) : null}
        </Section>

        <Section title="API Keys">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">API Keys</p>
                <p className="text-xs text-muted-foreground">
                  Manage your API keys for integrations
                </p>
              </div>
            </div>
            <Badge variant="outline">Coming Soon</Badge>
          </div>
        </Section>

        <Section title="Two-Factor Authentication">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
            </div>
            <Badge variant="outline">Coming Soon</Badge>
          </div>
        </Section>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: AccountSession }) {
  const lastActive = session.updatedAt ?? session.createdAt;
  const parts = [
    session.ip,
    session.current ? 'This device' : lastActive ? formatRelativeTime(new Date(lastActive)) : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center justify-between rounded-xl border border-input p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            session.current ? 'bg-emerald-500/10' : 'bg-muted',
          )}
        >
          <Monitor
            className={cn(
              'h-4 w-4',
              session.current ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          />
        </div>
        <div>
          <p className="text-sm font-medium">{describeDevice(session.userAgent)}</p>
          {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>}
        </div>
      </div>
      {session.current && (
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          Current
        </Badge>
      )}
    </div>
  );
}

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : userAgent.split(/[\s/]/)[0] || 'Client';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X|Macintosh/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad|iOS/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return os ? `${browser} on ${os}` : browser;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
