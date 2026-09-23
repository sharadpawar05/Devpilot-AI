import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyBestMatch, fuzzyFilter, highlightMatches } from '@/lib/fuzzy-search';

describe('fuzzyMatch', () => {
  it('returns empty match for empty query', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('matches exact substring with high score', () => {
    const exact = fuzzyMatch('code', 'Code Review');
    const prefix = fuzzyMatch('cod', 'Code Review');
    expect(exact).not.toBeNull();
    expect(prefix).not.toBeNull();
    expect(exact!.score).toBeGreaterThan(0);
    expect(prefix!.indices[0]).toBe(0);
  });

  it('matches subsequence characters in order', () => {
    const match = fuzzyMatch('dbrd', 'Dashboard');
    expect(match).not.toBeNull();
    // D(0) b(4) r(7) d(8)
    expect(match!.indices).toEqual([0, 4, 7, 8]);
  });

  it('returns null when characters are out of order', () => {
    expect(fuzzyMatch('zzz', 'Dashboard')).toBeNull();
    expect(fuzzyMatch('dnuhsa', 'Dashboard')).toBeNull();
  });

  it('ranks prefix matches higher than mid-word matches', () => {
    const prefix = fuzzyMatch('dash', 'Dashboard');
    const mid = fuzzyMatch('shbo', 'Dashboard');
    expect(prefix).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(prefix!.score).toBeGreaterThan(mid!.score);
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('DASH', 'dashboard')).not.toBeNull();
    expect(fuzzyMatch('dash', 'DASHBOARD')).not.toBeNull();
  });
});

describe('fuzzyBestMatch', () => {
  it('picks the best matching field', () => {
    const match = fuzzyBestMatch('hist', ['Dashboard', 'Search History', 'Navigation']);
    expect(match).not.toBeNull();
    expect(match!.fieldIndex).toBe(1);
  });

  it('returns null when no field matches', () => {
    expect(fuzzyBestMatch('xyz', ['abc', 'def'])).toBeNull();
  });
});

describe('fuzzyFilter', () => {
  const items = [
    { label: 'Dashboard', group: 'Navigation' },
    { label: 'Code Review', group: 'AI' },
    { label: 'History', group: 'History' },
  ];

  it('returns all items for empty query', () => {
    expect(fuzzyFilter('', items, (i) => [i.label])).toHaveLength(3);
  });

  it('filters and sorts by score', () => {
    const results = fuzzyFilter('review', items, (i) => [i.label, i.group]);
    expect(results).toHaveLength(1);
    expect(results[0].item.label).toBe('Code Review');
  });

  it('matches against secondary fields like group', () => {
    const results = fuzzyFilter('nav', items, (i) => [i.label, i.group]);
    expect(results.some((r) => r.item.label === 'Dashboard')).toBe(true);
  });
});

describe('highlightMatches', () => {
  it('wraps matched indices in mark elements', () => {
    const nodes = highlightMatches('Dashboard', [0, 1]);
    // React elements for marks + remaining plain text
    expect(nodes.length).toBeGreaterThan(1);
  });

  it('returns original text when no indices', () => {
    expect(highlightMatches('Dashboard', [])).toEqual(['Dashboard']);
  });
});
