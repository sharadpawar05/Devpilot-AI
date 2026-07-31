import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, AuthUser, AuthProvider as OAuthProvider } from '@engineering-ai/types';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(mapSession(s));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(mapSession(s));
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setSession(null);
  }, []);

  const value: AuthContextType = {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: !!session,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
