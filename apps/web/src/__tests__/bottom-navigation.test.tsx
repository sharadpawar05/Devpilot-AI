import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/bottom-navigation';
import { SidebarProvider } from '@/components/navigation/sidebar-provider';

function renderBottomNav() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <SidebarProvider>
        <BottomNavigation />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe('BottomNavigation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders primary mobile destinations', () => {
    renderBottomNav();
    expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /ai/i })).toHaveAttribute('href', '/playground');
    expect(screen.getByRole('link', { name: /chat/i })).toHaveAttribute('href', '/repository-chat');
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history');
  });

  it('includes a menu button that controls the sidebar sheet', () => {
    renderBottomNav();
    const menu = screen.getByRole('button', { name: /open navigation menu/i });
    expect(menu).toHaveAttribute('aria-controls', 'app-sidebar');
  });

  it('marks the active route', () => {
    renderBottomNav();
    const home = screen.getByRole('link', { name: /home/i });
    expect(home).toHaveAttribute('aria-current', 'page');
  });
});
