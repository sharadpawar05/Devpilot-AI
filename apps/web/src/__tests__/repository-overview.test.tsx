import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TechnologyStackCard, CompactHealthScore } from '@/components/repo-overview';
import type { DetectedTech, RepoHealthCheck, TechnologyStack } from '@/lib/repo-overview';

const tech = (name: string): DetectedTech => ({ name, confidence: 90, source: 'package.json' });

const sixCategoryStack: TechnologyStack = {
  architecture: [tech('Clean Architecture')],
  runtime: [tech('Node.js')],
  frontend: [tech('React')],
  backend: [tech('Fastify')],
  database: [tech('PostgreSQL')],
  testing: [tech('Vitest')],
};

describe('TechnologyStackCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('collapses to the first 4 categories and expands via View all', () => {
    render(<TechnologyStackCard stack={sixCategoryStack} />);

    expect(screen.getByText(/6 technologies across 6 categories/)).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('Fastify')).toBeInTheDocument();
    expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument();
    expect(screen.queryByText('Vitest')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View all/ }));

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Vitest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('hides the toggle when 4 or fewer categories exist', () => {
    render(
      <TechnologyStackCard
        stack={{
          frontend: [tech('React')],
          backend: [tech('Fastify')],
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /View all/ })).not.toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });
});

describe('CompactHealthScore', () => {
  afterEach(() => {
    cleanup();
  });

  const health: RepoHealthCheck = {
    score: 82,
    passedCount: 10,
    failedCount: 1,
    warningCount: 3,
    criticalCount: 1,
    details: [
      {
        id: 'security',
        name: 'Security',
        category: 'quality',
        status: 'failed',
        passed: false,
        severity: 'critical',
        failedDescription: '3 known vulnerabilities',
        whyItMatters: 'Security vulnerabilities can expose sensitive data.',
        recommendation: 'Update vulnerable dependencies.',
        estimatedEffort: '1-4 hours',
        actionLabel: 'Fix Vulnerabilities',
        actionType: 'fix-vulnerabilities',
        scorePenalty: 15,
        quality: { vulnerabilityCount: 3, criticalVulnerabilities: 1 },
      },
    ],
    scoreBreakdown: [],
    summary: {
      structuralScore: 90,
      qualityScore: 77,
      structuralWeight: 40,
      qualityWeight: 60,
    },
  };

  it('shows score, status, passed checks, needs attention, and security findings', () => {
    render(<CompactHealthScore health={health} />);

    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('10 passed')).toBeInTheDocument();
    expect(screen.getByText('3 needs attention')).toBeInTheDocument();
    expect(screen.getByText('1 critical')).toBeInTheDocument();
    expect(screen.getByText('3 security findings')).toBeInTheDocument();
  });

  it('invokes onViewDetails from the View Health Overview CTA', () => {
    const onViewDetails = vi.fn();
    render(<CompactHealthScore health={health} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Health Overview →' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('hides finding rows when there is nothing to report', () => {
    render(
      <CompactHealthScore
        health={{
          ...health,
          failedCount: 0,
          warningCount: 0,
          criticalCount: 0,
          details: [],
        }}
      />,
    );

    expect(screen.getByText('10 passed')).toBeInTheDocument();
    expect(screen.queryByText(/needs attention/)).not.toBeInTheDocument();
    expect(screen.queryByText(/security findings/)).not.toBeInTheDocument();
  });
});
