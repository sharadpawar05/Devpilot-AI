import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  CommandPalette,
  CommandPaletteProvider,
  useCommandPalette,
} from '@/components/command-palette';

vi.mock('@/hooks/use-github', () => ({
  useGitHub: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshConnection: vi.fn(),
  }),
}));

function OpenButton() {
  const { open } = useCommandPalette();
  return (
    <button type="button" onClick={open}>
      open
    </button>
  );
}

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPaletteProvider>
        <OpenButton />
        <CommandPalette />
      </CommandPaletteProvider>
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('is hidden until opened', () => {
    renderPalette();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with ⌘K', async () => {
    renderPalette();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    });
  });

  it('renders filter chips for command groups', async () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'GitHub' })).toBeInTheDocument();
  });

  it('filters commands when a chip is selected', async () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    });

    // Dashboard is Navigation-only and should not appear
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Review Code')).toBeInTheDocument();
  });

  it('shows recent searches when query is empty', async () => {
    localStorage.setItem('devpilot_recent_searches', JSON.stringify(['code review']));
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
    expect(screen.getByText('code review')).toBeInTheDocument();
  });

  it('filters with fuzzy search in real time', async () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const input = screen.getByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'plygrnd' } });

    await waitFor(() => {
      const results = screen.getByTestId('palette-results');
      expect(results.textContent).toContain('AI Playground');
      expect(results.textContent).not.toContain('Settings');
    });
  });

  it('shows empty state for no matches', async () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const input = screen.getByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'zzzzzzzzzz' } });

    await waitFor(() => {
      expect(screen.getByTestId('empty-results')).toBeInTheDocument();
    });
  });
});
