import { describe, it, expect } from 'vitest';
import { computeHealthTrend, extractCoverage } from '../health-trend';

describe('extractCoverage', () => {
  it('returns coverage when summary.testCoverage is a number', () => {
    expect(extractCoverage({ testCoverage: 78 })).toBe(78);
  });

  it('returns null when summary is missing or invalid', () => {
    expect(extractCoverage(null)).toBeNull();
    expect(extractCoverage(undefined)).toBeNull();
    expect(extractCoverage('nope')).toBeNull();
    expect(extractCoverage({ testCoverage: 'high' })).toBeNull();
    expect(extractCoverage({ testCoverage: null })).toBeNull();
    expect(extractCoverage({ testCoverage: Number.NaN })).toBeNull();
  });
});

describe('computeHealthTrend', () => {
  const previousAt = new Date('2026-09-01T10:00:00.000Z');

  it('computes an upward score trend', () => {
    const trend = computeHealthTrend(
      { score: 80, coverage: 78 },
      { score: 76, coverage: 76, createdAt: previousAt },
    );

    expect(trend.score).toEqual({
      current: 80,
      previous: 76,
      change: 4,
      direction: 'up',
    });
    expect(trend.coverage).toEqual({
      current: 78,
      previous: 76,
      change: 2,
      direction: 'up',
    });
    expect(trend.previousAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('computes a downward trend', () => {
    const trend = computeHealthTrend(
      { score: 60, coverage: 50 },
      { score: 70, coverage: 55, createdAt: previousAt },
    );

    expect(trend.score.direction).toBe('down');
    expect(trend.score.change).toBe(-10);
    expect(trend.coverage?.direction).toBe('down');
    expect(trend.coverage?.change).toBe(-5);
  });

  it('reports stable when values are unchanged', () => {
    const trend = computeHealthTrend(
      { score: 75, coverage: 70 },
      { score: 75, coverage: 70, createdAt: previousAt },
    );

    expect(trend.score.direction).toBe('stable');
    expect(trend.score.change).toBe(0);
    expect(trend.coverage?.direction).toBe('stable');
  });

  it('returns null coverage trend when coverage is not measured', () => {
    const trend = computeHealthTrend(
      { score: 75, coverage: null },
      { score: 75, coverage: null, createdAt: previousAt },
    );

    expect(trend.coverage).toBeNull();
    expect(trend.score.direction).toBe('stable');
  });

  it('returns null coverage trend when previous coverage is unknown', () => {
    const trend = computeHealthTrend(
      { score: 75, coverage: 80 },
      { score: 75, coverage: null, createdAt: previousAt },
    );

    expect(trend.coverage).toBeNull();
  });

  it('rounds fractional coverage changes to one decimal', () => {
    const trend = computeHealthTrend(
      { score: 75, coverage: 80.44 },
      { score: 75, coverage: 78.11, createdAt: previousAt },
    );

    expect(trend.coverage?.change).toBe(2.3);
  });

  it('accepts ISO string createdAt', () => {
    const trend = computeHealthTrend(
      { score: 75, coverage: null },
      { score: 74, coverage: null, createdAt: '2026-09-01T10:00:00.000Z' },
    );

    expect(trend.previousAt).toBe('2026-09-01T10:00:00.000Z');
    expect(trend.score.direction).toBe('up');
  });
});
