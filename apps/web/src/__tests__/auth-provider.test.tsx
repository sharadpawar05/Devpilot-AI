import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth';
import { AuthUnavailableError } from '@/lib/supabase-health';

const { mockHealth, mockOAuthSignIn } = vi.hoisted(() => ({
  mockHealth: vi.fn(),
  mockOAuthSignIn: vi.fn(),
}));

vi.mock('@/lib/supabase-health', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase-health')>();
  return {
    ...actual,
    isAuthServiceReachable: () => mockHealth(),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: mockOAuthSignIn,
      signOut: vi.fn(),
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe('AuthProvider signInWithOAuth', () => {
  beforeEach(() => {
    mockHealth.mockReset();
    mockOAuthSignIn.mockReset();
  });

  it('throws AuthUnavailableError and never redirects when the auth service is down', async () => {
    mockHealth.mockResolvedValue(false);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.signInWithOAuth('google')).rejects.toBeInstanceOf(
      AuthUnavailableError,
    );
    expect(mockOAuthSignIn).not.toHaveBeenCalled();
  });

  it('proceeds with the OAuth redirect when the auth service is reachable', async () => {
    mockHealth.mockResolvedValue(true);
    mockOAuthSignIn.mockResolvedValue({
      data: { url: 'https://test.supabase.co/auth/v1/authorize', provider: 'google' },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.signInWithOAuth('github');

    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(mockOAuthSignIn).toHaveBeenCalledWith(expect.objectContaining({ provider: 'github' }));
  });

  it('propagates OAuth errors from Supabase', async () => {
    mockHealth.mockResolvedValue(true);
    mockOAuthSignIn.mockResolvedValue({
      data: { url: null, provider: null },
      error: new Error('oauth configuration invalid'),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.signInWithOAuth('google')).rejects.toThrow(
      'oauth configuration invalid',
    );
  });
});
