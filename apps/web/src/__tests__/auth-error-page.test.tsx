import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthErrorPage } from '@/pages/auth-error';

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/error" element={<AuthErrorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthErrorPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows friendly copy for access_denied', () => {
    renderPage('/auth/error?error=access_denied&error_description=no+thanks');

    expect(
      screen.getByRole('heading', { level: 1, name: /sign-in cancelled/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cancelled or denied/i)).toBeInTheDocument();
  });

  it('shows service copy for unexpected_failure via error_code', () => {
    renderPage('/auth/error?error=server_error&error_code=unexpected_failure');

    expect(
      screen.getByRole('heading', { level: 1, name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/usually temporary/i)).toBeInTheDocument();
  });

  it('reads errors from the hash fragment', () => {
    renderPage('/auth/error#error=session_expired');

    expect(screen.getByRole('heading', { level: 1, name: /session expired/i })).toBeInTheDocument();
  });

  it('falls back to the description for unknown errors', () => {
    renderPage('/auth/error?error=odd_error&error_description=Account+sync+failed');

    expect(screen.getByRole('heading', { level: 1, name: /sign-in failed/i })).toBeInTheDocument();
    expect(screen.getByText('Account sync failed')).toBeInTheDocument();
  });

  it('shows generic copy when no error params are present', () => {
    renderPage('/auth/error');

    expect(screen.getByRole('heading', { level: 1, name: /sign-in failed/i })).toBeInTheDocument();
    expect(screen.getByText(/something went wrong while signing you in/i)).toBeInTheDocument();
  });

  it('offers retry and home actions', () => {
    renderPage('/auth/error?error=access_denied');

    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /go back home/i })).toHaveAttribute('href', '/');
  });
});
