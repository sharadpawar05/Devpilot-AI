import { describe, it, expect } from 'vitest';
import { formatRepoSize, formatStars, languageColor } from '@/lib/repo-card-utils';

describe('formatRepoSize', () => {
  it('formats KB, MB, and GB', () => {
    expect(formatRepoSize(512)).toBe('512 KB');
    expect(formatRepoSize(2048)).toBe('2.0 MB');
    expect(formatRepoSize(1024 * 1024 * 2.5)).toBe('2.5 GB');
  });

  it('handles missing and zero sizes', () => {
    expect(formatRepoSize(undefined)).toBe('—');
    expect(formatRepoSize(null)).toBe('—');
    expect(formatRepoSize(0)).toBe('0 KB');
  });
});

describe('formatStars', () => {
  it('formats thousands', () => {
    expect(formatStars(0)).toBe('0');
    expect(formatStars(999)).toBe('999');
    expect(formatStars(1234)).toBe('1.2k');
    expect(formatStars(15000)).toBe('15k');
  });

  it('handles null', () => {
    expect(formatStars(null)).toBe('0');
    expect(formatStars(undefined)).toBe('0');
  });
});

describe('languageColor', () => {
  it('returns known language colors', () => {
    expect(languageColor('TypeScript')).toBe('bg-blue-500');
    expect(languageColor('Python')).toBe('bg-green-500');
  });

  it('falls back for unknown or missing languages', () => {
    expect(languageColor('Brainfuck')).toBe('bg-muted-foreground/60');
    expect(languageColor(null)).toBe('bg-muted-foreground/50');
    expect(languageColor(undefined)).toBe('bg-muted-foreground/50');
  });
});
