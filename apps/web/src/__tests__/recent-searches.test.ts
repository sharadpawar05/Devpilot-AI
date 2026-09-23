import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from '@/components/command-palette/recent-searches';

describe('recent searches storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns empty array when nothing stored', () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it('adds searches to the front and dedupes', () => {
    addRecentSearch('dashboard');
    addRecentSearch('code review');
    addRecentSearch('dashboard');
    expect(getRecentSearches()).toEqual(['dashboard', 'code review']);
  });

  it('ignores empty queries', () => {
    addRecentSearch('   ');
    expect(getRecentSearches()).toEqual([]);
  });

  it('caps stored searches', () => {
    for (let i = 0; i < 20; i++) {
      addRecentSearch(`query-${i}`);
    }
    const stored = getRecentSearches();
    expect(stored.length).toBeLessThanOrEqual(8);
    expect(stored[0]).toBe('query-19');
  });

  it('removes a single search', () => {
    addRecentSearch('alpha');
    addRecentSearch('beta');
    removeRecentSearch('alpha');
    expect(getRecentSearches()).toEqual(['beta']);
  });

  it('clears all searches', () => {
    addRecentSearch('alpha');
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('devpilot_recent_searches', '{bad');
    expect(getRecentSearches()).toEqual([]);
  });
});
