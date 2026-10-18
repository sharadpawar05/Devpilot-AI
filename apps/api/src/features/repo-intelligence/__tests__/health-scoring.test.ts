import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/github', () => ({ getOctokit: vi.fn() }));
vi.mock('@/core/db', () => ({
  db: {
    repoHealthSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
  resolveLocalUserId: vi.fn().mockResolvedValue('local-user'),
}));

import { getOctokit } from '@/core/github';
import { db } from '@/core/db';
import { RepositoryIntelligenceService } from '../repository-service';
import type { HealthCheckDetail, RepositoryHealth } from '../types';

// Canonical max penalty per check id — this is the scoring contract that must
// stay in sync with the scorePenalty assigned to each check. Structural sum:
// 20+10+5+10+0+5 = 50. Quality sum: 30+25+30+20+12+10+20+20+15 = 182.
const MAX_PENALTY_BY_CHECK: Record<string, number> = {
  readme: 20,
  license: 10,
  gitignore: 5,
  'package-config': 10,
  docker: 0,
  'env-example': 5,
  'test-coverage': 30,
  'readme-quality': 25,
  'ci-cd': 30,
  security: 20,
  dependencies: 12,
  documentation: 10,
  complexity: 20,
  debt: 20,
  hotspots: 15,
};

const isMeasured = (d: HealthCheckDetail): boolean =>
  d.status !== 'not_measured' && d.status !== 'not_applicable';

/** Recomputes the canonical dimension score from returned details. */
function dimensionScore(details: HealthCheckDetail[], category: 'structural' | 'quality'): number {
  const measured = details.filter((d) => d.category === category && isMeasured(d));
  if (measured.length === 0) return 100;
  const penalty = measured.reduce((sum, d) => sum + d.scorePenalty, 0);
  const max = measured.reduce((sum, d) => sum + (MAX_PENALTY_BY_CHECK[d.id] ?? 0), 0) || 50;
  return Math.max(0, 100 - (penalty / max) * 100);
}

/** Recomputes the canonical overall score (weights renormalized over measured dimensions). */
function expectedOverallScore(details: HealthCheckDetail[]): number {
  const dims: Array<{ score: number; weight: number }> = [];
  const structural = details.filter((d) => d.category === 'structural' && isMeasured(d));
  const quality = details.filter((d) => d.category === 'quality' && isMeasured(d));
  if (structural.length > 0)
    dims.push({ score: dimensionScore(details, 'structural'), weight: 40 });
  if (quality.length > 0) dims.push({ score: dimensionScore(details, 'quality'), weight: 60 });
  const totalWeight = dims.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;
  return Math.round(dims.reduce((sum, d) => sum + (d.score * d.weight) / totalWeight, 0));
}

const README = `# My Project

This project does something useful for developers.

## Installation
npm install

## Usage
npm start

## Testing
npm test

## Contributing
PRs welcome.
`;

const WORKFLOW = `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: eslint .
`;

const SRC = `import { helper } from './helper';

export function main() {
  return helper();
}
`;

function checkById(health: RepositoryHealth, id: string): HealthCheckDetail {
  const check = health.details.find((d) => d.id === id);
  if (!check) throw new Error(`check ${id} not found`);
  return check;
}

describe('repository health scoring', () => {
  let service: RepositoryIntelligenceService;

  function setupService(opts: {
    filePaths: string[];
    contents?: Record<string, string>;
  }): RepositoryIntelligenceService {
    const svc = new RepositoryIntelligenceService();
    vi.spyOn(svc, 'getFlatFilePaths').mockResolvedValue(opts.filePaths);
    vi.spyOn(svc, 'getFileContent').mockImplementation((_u, _o, _r, path: string) => {
      const content = opts.contents?.[path];
      if (content === undefined) return Promise.resolve(null);
      return Promise.resolve({
        name: path.split('/').pop() ?? path,
        path,
        content,
        size: content.length,
      });
    });
    vi.spyOn(svc, 'getLatestCommitSha').mockResolvedValue(null);
    return svc;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOctokit).mockRejectedValue(new Error('Dependabot API not accessible'));
    vi.mocked(db.repoHealthSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(db.repoHealthSnapshot.upsert).mockResolvedValue({} as never);
    service = setupService({
      filePaths: [],
    });
  });

  it('preserves the documented 40/60 weights and canonical formula', async () => {
    service = setupService({
      filePaths: [
        'README.md',
        'LICENSE',
        '.gitignore',
        '.env.example',
        'Dockerfile',
        'docs/architecture.md',
        '.github/workflows/ci.yml',
        'src/index.ts',
        'src/server.ts',
        'tests/app.test.ts',
      ],
      contents: {
        'README.md': README,
        '.github/workflows/ci.yml': WORKFLOW,
        'src/index.ts': SRC,
        'src/server.ts': SRC,
        'tests/app.test.ts': SRC,
      },
    });

    const health = await service.getHealth('user-1', 'acme', 'demo');

    expect(health.summary.structuralWeight).toBe(40);
    expect(health.summary.qualityWeight).toBe(60);

    const structural = dimensionScore(health.details, 'structural');
    const quality = dimensionScore(health.details, 'quality');
    expect(health.summary.structuralScore).toBe(Math.round(structural));
    expect(health.summary.qualityScore).toBe(Math.round(quality));
    expect(health.score).toBe(expectedOverallScore(health.details));

    // Spot-check the known fixture values: structural penalty is only the
    // missing package.json (10/50 → 80), quality includes coverage-warning,
    // README-warning, partial CI, and missing package.json penalties.
    expect(health.summary.structuralScore).toBe(80);
    expect(health.score).toBe(81);
  });

  it('marks Docker as passed when a Dockerfile exists and N/A when absent', async () => {
    const withDocker = await setupService({
      filePaths: ['README.md', 'Dockerfile'],
      contents: { 'README.md': README },
    }).getHealth('user-1', 'acme', 'demo');
    const docker = checkById(withDocker, 'docker');
    expect(docker.status).toBe('passed');
    expect(docker.passed).toBe(true);
    expect(docker.scorePenalty).toBe(0);

    const withoutDocker = await setupService({
      filePaths: ['README.md'],
      contents: { 'README.md': README },
    }).getHealth('user-1', 'acme', 'demo');
    const noDocker = checkById(withoutDocker, 'docker');
    expect(noDocker.status).toBe('not_applicable');
    expect(noDocker.passed).toBe(false);
    expect(noDocker.scorePenalty).toBe(0);
    expect(withoutDocker.notMeasuredCount).toBeGreaterThan(0);
  });

  it('does not treat a missing coverage report as zero coverage', async () => {
    service = setupService({
      filePaths: ['README.md', 'tests/app.test.ts'],
      contents: { 'README.md': README, 'tests/app.test.ts': SRC },
    });

    const health = await service.getHealth('user-1', 'acme', 'demo');
    const coverage = checkById(health, 'test-coverage');

    expect(coverage.status).toBe('warning');
    expect(coverage.failedDescription).toContain('no coverage report available');
    expect(coverage.failedDescription).not.toContain('0%');
    expect(health.summary.testCoverage).toBeUndefined();
    expect(coverage.quality?.coverage).toBeUndefined();
  });

  it('reports unverifiable security as not_measured with no penalty and null score', async () => {
    service = setupService({
      filePaths: ['README.md'],
      contents: { 'README.md': README },
    });

    const health = await service.getHealth('user-1', 'acme', 'demo');
    const security = checkById(health, 'security');

    expect(security.status).toBe('not_measured');
    expect(security.scorePenalty).toBe(0);
    expect(health.summary.securityScore).toBeNull();
    expect(health.scoreBreakdown.some((b) => b.name === 'Security')).toBe(false);
    // Excluded from the measured quality checks entirely.
    expect(health.summary.qualityScore).toBe(Math.round(dimensionScore(health.details, 'quality')));
  });

  it('never fabricates scores when file contents cannot be fetched', async () => {
    service = setupService({
      filePaths: [
        'README.md',
        'LICENSE',
        '.gitignore',
        '.github/workflows/ci.yml',
        'docs/notes.md',
        'src/app.ts',
      ],
      contents: {}, // every content fetch returns null
    });

    const health = await service.getHealth('user-1', 'acme', 'demo');

    // README exists but content could not be fetched.
    const readmeQuality = checkById(health, 'readme-quality');
    expect(readmeQuality.status).toBe('not_measured');
    expect(readmeQuality.scorePenalty).toBe(0);
    expect(health.summary.documentationScore).toBeNull();

    // Workflow files exist but contents could not be fetched.
    const cicd = checkById(health, 'ci-cd');
    expect(cicd.status).toBe('not_measured');
    expect(cicd.scorePenalty).toBe(0);
    expect(health.summary.cicdScore).toBeNull();

    // No source contents → complexity/debt/hotspots are unmeasured, not passes.
    for (const id of ['complexity', 'debt', 'hotspots']) {
      const check = checkById(health, id);
      expect(check.status).toBe('not_measured');
      expect(check.passed).toBe(false);
      expect(check.scorePenalty).toBe(0);
    }
    expect(health.summary.complexityScore).toBeNull();
    expect(health.summary.debtScore).toBeNull();
    expect(health.summary.hotspotCount).toBeNull();
    expect(health.summary.maintainabilityScore).toBeNull();

    // Unmeasured checks are counted honestly and excluded from the formula.
    expect(health.notMeasuredCount).toBe(7);
    expect(health.score).toBe(expectedOverallScore(health.details));
    expect(health.summary.structuralWeight).toBe(40);
    expect(health.summary.qualityWeight).toBe(60);

    // No fabricated positive sub-scores leaked into the summary.
    expect(health.summary.securityScore).toBeNull();
    expect(health.summary.testCoverage).toBeUndefined();
  });

  it('keeps fetched content failures out of counts while real failures still count', async () => {
    service = setupService({
      filePaths: ['README.md', 'LICENSE', '.gitignore', 'src/app.ts'],
      contents: {},
    });

    const health = await service.getHealth('user-1', 'acme', 'demo');

    // Structural file-existence checks are always measurable.
    expect(checkById(health, 'readme').status).toBe('passed');
    expect(checkById(health, 'license').status).toBe('passed');
    // Missing package.json is a real, measured failure by product policy.
    expect(checkById(health, 'package-config').status).toBe('failed');
    expect(checkById(health, 'package-config').scorePenalty).toBeGreaterThan(0);
    // Unmeasured checks never count as failed or critical.
    const unmeasured = health.details.filter((d) => d.status === 'not_measured');
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const d of unmeasured) expect(d.scorePenalty).toBe(0);
    expect(health.criticalCount).toBe(
      health.details.filter((d) => !d.passed && isMeasured(d) && d.severity === 'critical').length,
    );
  });
});
