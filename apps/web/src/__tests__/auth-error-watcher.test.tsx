import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthErrorWatcher } from '@/auth/auth-error-watcher';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AuthErrorWatcher />}>
          <Route path="/" element={<div>home</div>} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route path="/login" element={<div>login</div>} />
          <Route path="/auth/error" element={<LocationProbe />} />
          <Route path="*" element={<div>not-found</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthErrorWatcher', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('redirects hash errors on /dashboard to /auth/error preserving params', async () => {
    renderAt('/dashboard#error=access_denied&error_description=no+thanks');

    const probe = await screen.findByTestId('location');
    expect(probe.textContent).toBe('/auth/error?error=access_denied&error_description=no+thanks');
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
  });

  it('redirects query errors on any route to /auth/error', async () => {
    renderAt('/login?error=server_error&error_code=unexpected_failure');

    const probe = await screen.findByTestId('location');
    expect(probe.textContent).toBe('/auth/error?error=server_error&error_code=unexpected_failure');
    expect(screen.queryByText('login')).not.toBeInTheDocument();
  });

  it('leaves normal navigation untouched', async () => {
    renderAt('/dashboard');

    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('leaves successful token hashes untouched', async () => {
    renderAt('/dashboard#access_token=abc123&token_type=bearer');

    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('does not loop when already on /auth/error', async () => {
    renderAt('/auth/error?error=access_denied');

    const probe = await screen.findByTestId('location');
    await waitFor(() => {
      expect(probe.textContent).toBe('/auth/error?error=access_denied');
    });
  });
});
