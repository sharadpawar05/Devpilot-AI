import { useState } from 'react';
import { AlertTriangle, Trash2, History, Unlink, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';

export function DangerZoneSettings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const gh = useGitHub();
  const { resetSettings } = useSettings();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          These actions are irreversible. Please be certain.
        </p>
      </div>

      <div className="space-y-4">
        <DangerCard
          icon={History}
          title="Clear History"
          description="Delete all your AI conversation history. This cannot be undone."
          actionLabel="Clear History"
          isConfirming={confirmAction === 'clear-history'}
          onConfirm={() => {
            localStorage.removeItem('devpilot_ai_history');
            resetSettings();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
          onTrigger={() => setConfirmAction('clear-history')}
        />

        <DangerCard
          icon={Unlink}
          title="Disconnect GitHub"
          description="Remove GitHub integration. You can reconnect later."
          actionLabel="Disconnect"
          isConfirming={confirmAction === 'disconnect-gh'}
          onConfirm={() => {
            gh.disconnect();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
          onTrigger={() => setConfirmAction('disconnect-gh')}
          disabled={!gh.connected}
        />

        <DangerCard
          icon={UserX}
          title="Delete Account"
          description="Permanently delete your account and all associated data."
          actionLabel="Delete Account"
          isConfirming={confirmAction === 'delete-account'}
          onConfirm={async () => {
            await signOut();
            localStorage.clear();
            navigate('/login');
          }}
          onCancel={() => setConfirmAction(null)}
          onTrigger={() => setConfirmAction('delete-account')}
        />
      </div>
    </div>
  );
}

function DangerCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  isConfirming,
  onConfirm,
  onCancel,
  onTrigger,
  disabled,
}: {
  icon: typeof Trash2;
  title: string;
  description: string;
  actionLabel: string;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onTrigger: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <Icon className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="shrink-0">
          {isConfirming ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={onConfirm} className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Confirm
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onTrigger}
              disabled={disabled}
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
