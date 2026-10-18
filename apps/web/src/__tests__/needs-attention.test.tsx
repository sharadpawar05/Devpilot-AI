import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NeedsAttentionCard } from '@/components/dashboard/NeedsAttentionCard';
import type { RepoHealthDetail } from '@/lib/repo-overview';

function finding(overrides: Partial<RepoHealthDetail>): RepoHealthDetail {
  return {
    id: 'readme-quality',
    name: 'README Quality',
    category: 'quality',
    status: 'failed',
    passed: false,
    severity: 'high',
    failedDescription: 'No README.md found',
    whyItMatters: 'New contributors cannot orient themselves.',
    recommendation: 'Add a README with setup instructions.',
    estimatedEffort: '1-2 hours',
    actionLabel: 'Generate README',
    actionType: 'generate-readme',
    scorePenalty: 10,
    ...overrides,
  };
}

function renderCard(details: RepoHealthDetail[]) {
  return render(
    <MemoryRouter>
      <NeedsAttentionCard
        details={details}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        hasRepo={true}
      />
    </MemoryRouter>,
  );
}

describe('NeedsAttentionCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('describes uncovered tests as coverage not measured instead of poor testing', () => {
    renderCard([
      finding({
        id: 'test-coverage',
        name: 'Testing',
        status: 'warning',
        severity: 'medium',
        failedDescription: '25 test file(s) found but no coverage report available',
        actionLabel: 'Improve Coverage',
        actionType: 'improve-coverage',
        scorePenalty: 5,
      }),
    ]);

    expect(screen.getByText('Testing — Coverage not measured')).toBeInTheDocument();
    expect(
      screen.getByText('25 test files detected, but no coverage report is available.'),
    ).toBeInTheDocument();
  });

  it('keeps the parse-failure wording accurate', () => {
    renderCard([
      finding({
        id: 'test-coverage',
        name: 'Testing',
        status: 'warning',
        severity: 'medium',
        failedDescription: '8 test file(s) found but the coverage report could not be parsed',
        actionLabel: 'Improve Coverage',
        actionType: 'improve-coverage',
        scorePenalty: 5,
      }),
    ]);

    expect(screen.getByText('Testing — Coverage not measured')).toBeInTheDocument();
    expect(
      screen.getByText('8 test files detected, but the coverage report could not be parsed.'),
    ).toBeInTheDocument();
  });

  it('leaves other findings untouched', () => {
    renderCard([
      finding({}),
      finding({
        id: 'test-coverage',
        name: 'Testing',
        status: 'failed',
        severity: 'high',
        failedDescription: 'No automated tests detected',
        actionLabel: 'Improve Coverage',
        actionType: 'improve-coverage',
        scorePenalty: 30,
      }),
    ]);

    expect(screen.getByText('README Quality')).toBeInTheDocument();
    expect(screen.getByText('No README.md found')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('No automated tests detected')).toBeInTheDocument();
    expect(screen.queryByText(/Coverage not measured/)).toBeNull();
  });

  it('routes to the health report', () => {
    renderCard([finding({})]);
    expect(screen.getByRole('button', { name: /findings in health report/i })).toBeInTheDocument();
  });
});
