import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/login';
import { AuthUnavailableError } from '@/lib/supabase-health';

const { mockSignInWithOAuth } = vi.hoisted(() => ({ mockSignInWithOAuth: vi.fn() }));

vi.mock('@/auth', () => ({
  useAuth: () => ({ signInWithOAuth: mockSignInWithOAuth }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders both sign-in options', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
  });

  it('calls signInWithOAuth and disables buttons while checking', async () => {
    let resolveSignIn!: () => void;
    mockSignInWithOAuth.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /continue with github/i })).toBeDisabled();
    });

    resolveSignIn();
  });

  it('shows a proper unavailable screen when the auth service is down', async () => {
    mockSignInWithOAuth.mockRejectedValue(new AuthUnavailableError());

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(screen.getByText(/sign-in temporarily unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/couldn.t reach our authentication service/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go back home/i })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('retries the same provider from the unavailable screen', async () => {
    mockSignInWithOAuth
      .mockRejectedValueOnce(new AuthUnavailableError())
      .mockResolvedValue(undefined);

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    const retryButton = await screen.findByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(2);
      expect(mockSignInWithOAuth).toHaveBeenLastCalledWith('google');
    });
  });

  it('shows an error alert with the message for unexpected failures', async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error('Provider login is disabled'));

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));

    await waitFor(() => {
      expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument();
      expect(screen.getByText('Provider login is disabled')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });
});
