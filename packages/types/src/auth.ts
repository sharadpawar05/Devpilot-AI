export type AuthProvider = 'google' | 'github';

export type Role = 'admin' | 'manager' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  authProvider: AuthProvider;
  createdAt: string;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}

export interface OAuthConfig {
  provider: AuthProvider;
  redirectTo?: string;
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
