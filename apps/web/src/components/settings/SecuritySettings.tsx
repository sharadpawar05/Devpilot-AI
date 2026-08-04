import { Lock, Key, Smartphone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function SecuritySettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your account security.</p>
      </div>

      <div className="space-y-6">
        <Section title="Active Sessions">
          <div className="rounded-xl border border-input p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Monitor className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Current Session</p>
                  <p className="text-xs text-muted-foreground">This browser · Active now</p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                Active
              </Badge>
            </div>
          </div>
        </Section>

        <Section title="Login History">
          <div className="flex items-center gap-3 rounded-xl border border-input p-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Login</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Password">
          <Button variant="outline" className="gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </Button>
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

function Monitor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
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
