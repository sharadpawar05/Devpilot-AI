import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Session, AuthUser, AuthProvider as OAuthProvider } from '@devpilot/types';
import { supabase } from '@/lib/supabase';
import { AuthUnavailableError, isAuthServiceReachable } from '@/lib/supabase-health';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithOAuth: (
    provider: OAuthProvider,
    options?: { redirectTo?: string; forceLogin?: boolean },
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development-only diagnostics. Never log tokens, Authorization headers, or cookies.
function debugAuthEvent(event: string, expiresAt: number | undefined): void {
  if (!import.meta.env.DEV) return;
  const now = Math.floor(Date.now() / 1000);
  console.debug('[Auth] event:', event);
  console.debug('[Auth] session exists:', expiresAt !== undefined);
  console.debug('[Auth] access token expiry:', expiresAt ?? null);
  console.debug('[Auth] current time:', now);
  console.debug('[Auth] seconds until expiry:', expiresAt !== undefined ? expiresAt - now : null);
}

// Avoid redundant state updates (and the re-render cascade they cause) when a
// notification carries the same access token we already hold. This does not
// interfere with refresh: a real TOKEN_REFRESHED always changes the token.
function sessionsEquivalent(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.accessToken === b.accessToken && a.expiresAt === b.expiresAt;
}

function mapSession(
  supabaseSession: {
    user: {
      id: string;
      email?: string;
      user_metadata: Record<string, unknown>;
      created_at: string;
    };
    access_token: string;
    expires_at?: number;
  } | null,
): Session | null {
  if (!supabaseSession) return null;

  const { user } = supabaseSession;
  const metadata = user.user_metadata as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    provider_id?: string;
  };

  const name = metadata.full_name || metadata.name || user.email || 'User';
  const avatarUrl = metadata.avatar_url || metadata.picture;
  const provider = metadata.provider_id === 'github' ? 'github' : 'google';

  const authUser: AuthUser = {
    id: user.id,
    email: user.email || '',
    name,
    avatarUrl,
    role: 'user',
    authProvider: provider,
    createdAt: user.created_at,
  };

  return {
    user: authUser,
    accessToken: supabaseSession.access_token,
    expiresAt: supabaseSession.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      debugAuthEvent('getSession', s?.expires_at);
      setSession((prev) => {
        const next = mapSession(s);
        return sessionsEquivalent(prev, next) ? prev : next;
      });
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      // Update React state only. Supabase handles automatic token refresh
      // (autoRefreshToken); never call refreshSession() from this listener.
      debugAuthEvent(event, s?.expires_at);
      setSession((prev) => {
        const next = mapSession(s);
        return sessionsEquivalent(prev, next) ? prev : next;
      });
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider, options?: { redirectTo?: string; forceLogin?: boolean }) => {
      const reachable = await isAuthServiceReachable();
      if (!reachable) {
        throw new AuthUnavailableError();
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options?.redirectTo ?? `${window.location.origin}/dashboard`,
          // Ask the provider to re-prompt credentials (used for re-auth flows
          // such as account deletion confirmation).
          ...(options?.forceLogin ? { queryParams: { prompt: 'login' } } : {}),
        },
      });

      if (error) {
        throw error;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Local sign-out must always succeed: a server-side logout can fail when
    // the auth user was already deleted (e.g. account deletion). Fall back to
    // clearing the local session so the app can leave authenticated routes.
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore — cleared in state below regardless
      }
    }
    setSession(null);
  }, []);

  const value: AuthContextType = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isAuthenticated: !!session,
      signInWithOAuth,
      signOut,
    }),
    [session, isLoading, signInWithOAuth, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
