import { describe, it, expect } from 'vitest';
import { parseCoverageReports } from '../coverage-analyzer';

const istanbulSummary = JSON.stringify({
  total: { statements: { pct: 78.4 }, lines: { pct: 80.1 } },
});

const lcovInfo = [
  'TN:',
  'SF:src/index.ts',
  'LF:100',
  'LH:75',
  'end_of_record',
  'SF:src/util.ts',
  'LF:50',
  'LH:45',
  'end_of_record',
  '',
].join('\n');

describe('parseCoverageReports', () => {
  it('parses istanbul coverage-summary.json', () => {
    expect(
      parseCoverageReports([{ path: 'coverage/coverage-summary.json', content: istanbulSummary }]),
    ).toBe(78.4);
  });

  it('falls back to total.lines.pct when statements missing', () => {
    const summary = JSON.stringify({ total: { lines: { pct: 64 } } });
    expect(
      parseCoverageReports([{ path: 'coverage/coverage-summary.json', content: summary }]),
    ).toBe(64);
  });

  it('parses lcov.info line rate across multiple records', () => {
    // (75+45) / (100+50) = 80%
    expect(parseCoverageReports([{ path: 'coverage/lcov.info', content: lcovInfo }])).toBe(80);
  });

  it('prefers coverage-summary.json over lcov.info', () => {
    expect(
      parseCoverageReports([
        { path: 'coverage/lcov.info', content: lcovInfo },
        { path: 'coverage/coverage-summary.json', content: istanbulSummary },
      ]),
    ).toBe(78.4);
  });

  it('uses lcov.info when the JSON summary is malformed', () => {
    expect(
      parseCoverageReports([
        { path: 'coverage/coverage-summary.json', content: 'not json' },
        { path: 'coverage/lcov.info', content: lcovInfo },
      ]),
    ).toBe(80);
  });

  it('returns undefined when no report can be parsed', () => {
    expect(parseCoverageReports([])).toBeUndefined();
    expect(parseCoverageReports([{ path: 'README.md', content: '# hi' }])).toBeUndefined();
    expect(
      parseCoverageReports([{ path: 'coverage/lcov.info', content: 'TN:\nSF:src/index.ts\n' }]),
    ).toBeUndefined();
  });

  it('clamps out-of-range values to 0-100', () => {
    const tooHigh = JSON.stringify({ total: { statements: { pct: 140 } } });
    expect(
      parseCoverageReports([{ path: 'coverage/coverage-summary.json', content: tooHigh }]),
    ).toBe(100);
  });
});
