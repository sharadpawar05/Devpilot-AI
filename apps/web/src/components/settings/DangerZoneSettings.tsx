import { useState } from 'react';
import { AlertTriangle, History, Loader2, Trash2, Unlink, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useStartAccountDeleteChallenge, useDeleteAccount } from '@/hooks/use-settings';
import { aiHistoryApi, aiHistoryStorage } from '@/lib/ai-history';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';

// localStorage flag marking an in-progress delete flow between issuing the
// signed challenge cookie and re-authenticating (must be consumed within the
// cookie's 10-minute lifetime).
const PENDING_KEY = 'devpilot_account_delete_flow';
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

// Server messages that mean "the challenge is stale or re-auth didn't happen"
// — recover by clearing the flag and returning to step one.
const REAUTH_ERROR =
  /start the delete flow first|invalid delete challenge|different user|sign back in to confirm deletion/i;

function readPendingFlag(): boolean {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ts?: number };
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > CHALLENGE_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return false;
  }
}

export function DangerZoneSettings() {
  const navigate = useNavigate();
  const { user, session, signOut, signInWithOAuth } = useAuth();
  const gh = useGitHub();
  const { addToast } = useToast();
  const startChallenge = useStartAccountDeleteChallenge();
  const deleteAccount = useDeleteAccount();

  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [pendingReauth, setPendingReauth] = useState(readPendingFlag);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const busy = startChallenge.isPending || deleteAccount.isPending || clearing || transitioning;

  const handleClearHistoryConfirm = async () => {
    setError(null);
    setClearing(true);
    try {
      const token = session?.accessToken;
      if (token) {
        const ids: string[] = [];
        let page = 1;
        for (;;) {
          const res = await aiHistoryApi.listSessions(token, {}, { page, pageSize: 100 });
          const batch = res.sessions.map((s) => s.id);
          ids.push(...batch);
          if (batch.length === 0 || !res.pagination.hasMore) break;
          page += 1;
          if (page > 100) break; // safety cap: 10k sessions
        }
        let deleted = 0;
        for (let i = 0; i < ids.length; i += 100) {
          deleted += await aiHistoryApi.deleteSessions(token, ids.slice(i, i + 100));
        }
        if (ids.length > 0 && deleted === 0) {
          throw new Error('Could not delete conversation history');
        }
      }
      await aiHistoryStorage.clearAll().catch(() => undefined);
      addToast('AI conversation history cleared', 'success');
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setError(null);
    if (!pendingReauth) {
      try {
        // Step 1: bind the challenge to the current session, then force a
        // re-login — the new session_id is what unlocks the DELETE below.
        await startChallenge.mutateAsync();
        localStorage.setItem(PENDING_KEY, JSON.stringify({ ts: Date.now() }));
        setPendingReauth(true);
        // Stay busy through the redirect hand-off: isPending flips false as
        // soon as the challenge resolves, which would otherwise re-enable
        // Confirm while the OAuth navigation is still in flight.
        setTransitioning(true);
        await signInWithOAuth(user?.authProvider ?? 'google', {
          redirectTo: `${window.location.origin}/settings?tab=danger`,
          forceLogin: true,
        });
      } catch (err) {
        // The redirect never happened — drop the flag so the stale challenge
        // can't be treated as a completed re-auth.
        localStorage.removeItem(PENDING_KEY);
        setPendingReauth(false);
        setTransitioning(false);
        setConfirmAction(null);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
      return;
    }

    // Step 2: delete for real (challenge cookie + new session id).
    try {
      await deleteAccount.mutateAsync();
      localStorage.removeItem(PENDING_KEY);
      setPendingReauth(false);
      await aiHistoryStorage.clearAll().catch(() => undefined);
      await signOut().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (REAUTH_ERROR.test(message)) {
        localStorage.removeItem(PENDING_KEY);
        setPendingReauth(false);
        setConfirmAction(null);
        setError('The re-authentication expired. Please start the deletion flow again.');
      } else {
        // Transient failure — stay on the final step so the user can retry
        // without redoing the OAuth round-trip.
        setError(message);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          These actions are irreversible. Please be certain.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-4">
        <DangerCard
          icon={History}
          title="Clear History"
          description="Delete all your AI conversation history. This cannot be undone."
          actionLabel="Clear History"
          isConfirming={confirmAction === 'clear-history'}
          onConfirm={handleClearHistoryConfirm}
          onCancel={() => {
            setConfirmAction(null);
            setError(null);
          }}
          onTrigger={() => setConfirmAction('clear-history')}
          busy={clearing}
          confirmLabel={clearing ? 'Clearing…' : 'Confirm'}
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
          description={
            pendingReauth
              ? 'Re-authentication confirmed. This permanently deletes your account and all data.'
              : 'Permanently delete your account and all associated data. You will be asked to sign in again to confirm.'
          }
          actionLabel="Delete Account"
          isConfirming={confirmAction === 'delete-account'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            if (pendingReauth) {
              localStorage.removeItem(PENDING_KEY);
              setPendingReauth(false);
            }
            setConfirmAction(null);
            setError(null);
          }}
          onTrigger={() => setConfirmAction('delete-account')}
          busy={busy && confirmAction === 'delete-account'}
          confirmLabel={
            busy && confirmAction === 'delete-account'
              ? 'Working…'
              : pendingReauth
                ? 'Confirm & Delete'
                : 'Continue'
          }
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
  busy,
  confirmLabel,
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
  busy?: boolean;
  confirmLabel?: string;
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
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirm}
                disabled={busy}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {confirmLabel ?? 'Confirm'}
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
