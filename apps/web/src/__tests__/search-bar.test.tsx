import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { SearchBar } from '@/components/search';
import { CommandPalette, CommandPaletteProvider } from '@/components/command-palette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/use-github', () => ({
  useGitHub: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshConnection: vi.fn(),
  }),
}));

function renderSearchBar() {
  return render(
    <MemoryRouter>
      <CommandPaletteProvider>
        <SearchBar />
        <CommandPalette />
      </CommandPaletteProvider>
    </MemoryRouter>,
  );
}

describe('SearchBar', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders search input with command palette affordance', () => {
    renderSearchBar();
    expect(screen.getByRole('combobox', { name: /search commands/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument();
  });

  it('shows real-time fuzzy results while typing', async () => {
    renderSearchBar();
    const input = screen.getByRole('combobox', { name: /search commands/i });
    fireEvent.change(input, { target: { value: 'code' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
    });

    const dropdown = screen.getByTestId('search-dropdown');
    expect(dropdown.textContent).toContain('Code Review');
  });

  it('shows recent searches when focused with empty query', async () => {
    localStorage.setItem('devpilot_recent_searches', JSON.stringify(['pr assistant', 'dashboard']));
    renderSearchBar();
    const input = screen.getByRole('combobox', { name: /search commands/i });
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByTestId('search-recent')).toBeInTheDocument();
    });
    expect(screen.getByText('pr assistant')).toBeInTheDocument();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('opens command palette with ⌘K', async () => {
    renderSearchBar();
    const input = screen.getByRole('combobox', { name: /search commands/i });
    fireEvent.keyDown(input, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    });
  });

  it('navigates when selecting a navigation result', async () => {
    renderSearchBar();
    const input = screen.getByRole('combobox', { name: /search commands/i });
    fireEvent.change(input, { target: { value: 'dashboard' } });

    let dashboardButton: HTMLElement | undefined;
    await waitFor(() => {
      const dropdown = screen.getByTestId('search-dropdown');
      dashboardButton = Array.from(dropdown.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Dashboard'),
      );
      expect(dashboardButton).toBeDefined();
    });

    fireEvent.click(dashboardButton!);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
