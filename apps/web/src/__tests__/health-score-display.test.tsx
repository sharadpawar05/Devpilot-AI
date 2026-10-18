import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HealthScore, HealthDimensions } from '@/components/repo-overview';
import type {
  RepoHealthCheck,
  RepoHealthDetail,
  RepositoryHealthSummary,
} from '@/lib/repo-overview';

function makeDetail(overrides: Partial<RepoHealthDetail> = {}): RepoHealthDetail {
  return {
    id: 'readme',
    name: 'README present',
    category: 'structural',
    status: 'passed',
    passed: true,
    severity: 'low',
    failedDescription: 'README.md exists',
    whyItMatters: 'Docs matter.',
    recommendation: 'Keep it updated.',
    estimatedEffort: '30-60 minutes',
    actionLabel: 'Improve README',
    actionType: 'improve-readme',
    scorePenalty: 0,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<RepositoryHealthSummary> = {}): RepositoryHealthSummary {
  return {
    structuralScore: 73,
    qualityScore: 61,
    structuralWeight: 40,
    qualityWeight: 60,
    securityScore: 88,
    dependencyScore: 70,
    maintainabilityScore: 65,
    complexityScore: 84,
    testCoverage: 85,
    cicdScore: 74,
    documentationScore: 90,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<RepoHealthCheck> = {}): RepoHealthCheck {
  return {
    score: 71,
    passedCount: 9,
    failedCount: 1,
    warningCount: 0,
    criticalCount: 0,
    notMeasuredCount: 1,
    details: [],
    scoreBreakdown: [],
    summary: makeSummary(),
    ...overrides,
  };
}

describe('HealthScore — displayed score is the API score', () => {
  afterEach(cleanup);

  it('renders the API-provided overall score without recomputing it client-side', () => {
    // 0.4×73 + 0.6×61 = 65.8 → 66 if recomputed. The API says 71 and 71 must show.
    render(<HealthScore health={makeHealth({ score: 71 })} />);

    expect(screen.getByText('71')).toBeInTheDocument();
    expect(screen.queryByText('66')).not.toBeInTheDocument();
  });

  it('shows dimension scores from the summary exactly as provided', () => {
    render(<HealthScore health={makeHealth()} />);

    expect(screen.getByText('73/100')).toBeInTheDocument();
    expect(screen.getByText('61/100')).toBeInTheDocument();
    expect(screen.getByText('88/100')).toBeInTheDocument();
  });

  it('hides a dimension whose score is null instead of showing a fabricated number', () => {
    render(<HealthScore health={makeHealth({ summary: makeSummary({ securityScore: null }) })} />);

    expect(screen.queryByText('Security')).not.toBeInTheDocument();
    expect(screen.queryByText('0/100')).not.toBeInTheDocument();
    // Other measured dimensions still render.
    expect(screen.getByText('73/100')).toBeInTheDocument();
  });

  it('renders unmeasured checks with an explicit "Not Measured" state', () => {
    render(
      <HealthScore
        health={makeHealth({
          failedCount: 1,
          details: [
            makeDetail({
              id: 'complexity',
              name: 'Code Complexity & File Size',
              category: 'quality',
              status: 'not_measured',
              passed: false,
              failedDescription: 'No source file contents available to analyze complexity',
            }),
            makeDetail({ id: 'package-config', status: 'failed', passed: false, scorePenalty: 10 }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Code Complexity & File Size')).toBeInTheDocument();
    expect(screen.getByText('Not Measured')).toBeInTheDocument();
  });

  it('documents that unmeasured dimensions are renormalized out of the formula', () => {
    render(<HealthScore health={makeHealth()} />);

    expect(screen.getByText(/renormalized/)).toBeInTheDocument();
  });
});

describe('HealthDimensions — missing measurements show N/A', () => {
  afterEach(cleanup);

  it('shows N/A for null dimension scores instead of a fabricated number', () => {
    render(
      <HealthDimensions
        summary={makeSummary({ complexityScore: null, maintainabilityScore: null })}
      />,
    );

    expect(screen.getByText('Complexity')).toBeInTheDocument();
    expect(screen.getByText('Maintainability')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the number when a dimension is measured', () => {
    render(
      <HealthDimensions
        summary={makeSummary({ complexityScore: 92, maintainabilityScore: null })}
      />,
    );

    expect(screen.getByText('Complexity')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    // Only the null maintainability dimension reads N/A in this fixture.
    expect(screen.getAllByText('N/A')).toHaveLength(1);
  });
});
