import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RepositoryCard, RepositoryGrid, RepositoryGridSkeleton } from '@/components/repository';
import type { GitHubRepo } from '@/hooks/use-github';

const baseRepo: GitHubRepo = {
  id: 1,
  name: 'devpilot',
  full_name: 'acme/devpilot',
  private: false,
  description: 'AI coding assistant',
  language: 'TypeScript',
  updated_at: '2026-01-01T00:00:00Z',
  html_url: 'https://github.com/acme/devpilot',
  stargazers_count: 1234,
  forks_count: 56,
  size: 2048,
};

describe('RepositoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders name, description, and metadata', () => {
    render(<RepositoryCard repo={baseRepo} />);
    expect(screen.getByTestId('repository-card')).toHaveAttribute('data-repo', 'acme/devpilot');
    expect(screen.getByRole('button', { name: 'devpilot' })).toBeInTheDocument();
    expect(screen.getByText('AI coding assistant')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('1.2k')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('shows private badge when repo is private', () => {
    render(<RepositoryCard repo={{ ...baseRepo, private: true }} />);
    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('invokes onSelect when name is clicked', () => {
    const onSelect = vi.fn();
    render(<RepositoryCard repo={baseRepo} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'devpilot' }));
    expect(onSelect).toHaveBeenCalledWith('acme/devpilot');
  });

  it('exposes quick actions for chat, review, and analyze', () => {
    const onChat = vi.fn();
    const onReview = vi.fn();
    const onAnalyze = vi.fn();
    render(
      <RepositoryCard repo={baseRepo} onChat={onChat} onReview={onReview} onAnalyze={onAnalyze} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /chat repository/i }));
    fireEvent.click(screen.getByRole('button', { name: /review repository/i }));
    fireEvent.click(screen.getByRole('button', { name: /analyze repository/i }));

    expect(onChat).toHaveBeenCalledWith('acme/devpilot');
    expect(onReview).toHaveBeenCalledWith('acme/devpilot');
    expect(onAnalyze).toHaveBeenCalledWith('acme/devpilot');
  });

  it('links to GitHub', () => {
    render(<RepositoryCard repo={baseRepo} />);
    const link = screen.getByRole('link', { name: /open acme\/devpilot on github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/acme/devpilot');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('RepositoryGrid', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a responsive grid of repository cards', () => {
    render(
      <RepositoryGrid
        repositories={[baseRepo, { ...baseRepo, id: 2, full_name: 'acme/other', name: 'other' }]}
      />,
    );
    const grid = screen.getByTestId('repository-grid');
    expect(grid).toHaveClass('grid');
    expect(screen.getAllByTestId('repository-card')).toHaveLength(2);
  });

  it('shows loading skeletons when loading', () => {
    render(<RepositoryGrid repositories={[]} loading skeletonCount={3} />);
    expect(screen.getByTestId('repository-grid-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('repository-grid-skeleton')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows empty message when no repos', () => {
    render(<RepositoryGrid repositories={[]} emptyMessage="Nothing here" />);
    expect(screen.getByTestId('repository-grid-empty')).toHaveTextContent('Nothing here');
  });

  it('marks the selected repository', () => {
    render(<RepositoryGrid repositories={[baseRepo]} selectedRepo="acme/devpilot" />);
    const card = screen.getByTestId('repository-card');
    expect(card.className).toContain('border-primary');
  });

  it('respects limit', () => {
    const repos = Array.from({ length: 10 }, (_, i) => ({
      ...baseRepo,
      id: i + 1,
      name: `repo-${i}`,
      full_name: `acme/repo-${i}`,
    }));
    render(<RepositoryGrid repositories={repos} limit={4} />);
    expect(screen.getAllByTestId('repository-card')).toHaveLength(4);
  });
});

describe('RepositoryGridSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the requested number of skeletons', () => {
    render(<RepositoryGridSkeleton count={4} />);
    // skeleton cards are direct children of the grid
    const skeleton = screen.getByTestId('repository-grid-skeleton');
    expect(skeleton.querySelectorAll(':scope > div')).toHaveLength(4);
  });
});
