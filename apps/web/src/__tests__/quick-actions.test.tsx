import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useUsage } from '@/hooks/use-usage';
import { usageQuerySuccess, usageFixture } from '@/test/usage-query';

vi.mock('@/hooks/use-usage');

const mockUseUsage = vi.mocked(useUsage);

function renderQuickActions() {
  return render(
    <MemoryRouter>
      <QuickActions />
    </MemoryRouter>,
  );
}

describe('QuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps every action available while AI credits remain', () => {
    mockUseUsage.mockReturnValue(usageQuerySuccess(usageFixture({})));

    renderQuickActions();

    expect(screen.queryByText('AI credits exhausted')).toBeNull();
    for (const name of [
      'Review Code',
      'Review Pull Request',
      'Repository Chat',
      'AI Playground',
      'Repository Overview',
    ]) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('locks credit-consuming actions and explains why when credits are exhausted', () => {
    mockUseUsage.mockReturnValue(
      usageQuerySuccess(
        usageFixture({
          usage: { aiCredits: 50 },
          limits: { aiCredits: 50 },
          remaining: { aiCredits: 0 },
        }),
      ),
    );

    renderQuickActions();

    expect(screen.getAllByText('AI credits exhausted')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Review Code/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: /Repository Chat/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Repository Overview' })).not.toHaveAttribute(
      'aria-disabled',
    );

    fireEvent.click(screen.getByRole('button', { name: /Review Code/ }));

    expect(screen.getByText('AI credit limit reached')).toBeInTheDocument();
    expect(screen.getByText('Your monthly AI allowance has been used.')).toBeInTheDocument();
    expect(screen.getByText(/Resets Oct 1/)).toBeInTheDocument();
  });

  it('does not lock actions when a single credit remains', () => {
    mockUseUsage.mockReturnValue(
      usageQuerySuccess(
        usageFixture({
          usage: { aiCredits: 49 },
          limits: { aiCredits: 50 },
          remaining: { aiCredits: 1 },
        }),
      ),
    );

    renderQuickActions();

    expect(screen.queryByText('AI credits exhausted')).toBeNull();
    expect(screen.getByRole('button', { name: 'Repository Chat' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });
});
