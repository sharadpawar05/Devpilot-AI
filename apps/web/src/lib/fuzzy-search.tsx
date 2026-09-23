import type { ReactNode } from 'react';

export interface FuzzyMatch {
  score: number;
  indices: number[];
}

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  return prev === ' ' || prev === '-' || prev === '_' || prev === '/' || prev === '.';
}

function isCamelBoundary(text: string, index: number): boolean {
  if (index === 0) return false;
  const prev = text[index - 1];
  const curr = text[index];
  return prev === prev.toLowerCase() && curr === curr.toUpperCase() && curr !== curr.toLowerCase();
}

/**
 * Subsequence fuzzy match with scoring for ranking.
 * Returns null when query characters cannot be found in order.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();

  if (!q) return { score: 0, indices: [] };
  if (q.length > t.length) return null;

  // Fast path: exact substring gets a strong boost
  const exactIdx = t.indexOf(q);
  if (exactIdx >= 0) {
    const indices = Array.from({ length: q.length }, (_, i) => exactIdx + i);
    let score = 50 + (exactIdx === 0 ? 30 : 10) + Math.min(q.length, 20);
    if (exactIdx > 0 && isWordBoundary(text, exactIdx)) score += 8;
    return { score, indices };
  }

  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let prevMatch = -2;

  for (let qi = 0; qi < q.length; qi++) {
    const target = q[qi];
    let found = -1;

    while (ti < t.length) {
      if (t[ti] === target) {
        found = ti;
        break;
      }
      ti++;
    }

    if (found < 0) return null;

    indices.push(found);

    if (found === prevMatch + 1) {
      score += 8; // consecutive
    } else if (found - prevMatch > 1) {
      score -= Math.min(found - prevMatch - 1, 4); // gap penalty
    }

    if (isWordBoundary(text, found)) score += 12;
    else if (isCamelBoundary(text, found)) score += 6;
    else score += 1;

    prevMatch = found;
    ti = found + 1;
  }

  // Prefer shorter texts when scores are close
  score += Math.max(0, 10 - Math.floor((text.length - q.length) / 8));
  return { score, indices };
}

/**
 * Best match across multiple haystack fields (e.g. label + group + keywords).
 * Returns the highest-scoring match; indices always refer to the winning field.
 */
export function fuzzyBestMatch(
  query: string,
  fields: string[],
): (FuzzyMatch & { fieldIndex: number }) | null {
  let best: (FuzzyMatch & { fieldIndex: number }) | null = null;
  for (let i = 0; i < fields.length; i++) {
    const match = fuzzyMatch(query, fields[i]);
    if (match && (!best || match.score > best.score)) {
      best = { ...match, fieldIndex: i };
    }
  }
  return best;
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getFields: (item: T) => string[],
): Array<{ item: T; match: FuzzyMatch | null }> {
  if (!query.trim()) {
    return items.map((item) => ({ item, match: null }));
  }

  const results: Array<{ item: T; match: FuzzyMatch }> = [];
  for (const item of items) {
    const match = fuzzyBestMatch(query, getFields(item));
    if (match) results.push({ item, match });
  }

  results.sort((a, b) => b.match.score - a.match.score);
  return results;
}

export function highlightMatches(text: string, indices: number[]): ReactNode[] {
  if (indices.length === 0) return [text];

  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const result: ReactNode[] = [];
  let lastIndex = 0;

  for (const idx of sorted) {
    if (idx < 0 || idx >= text.length) continue;
    if (idx > lastIndex) {
      result.push(text.slice(lastIndex, idx));
    }
    result.push(
      <mark key={idx} className="rounded-sm bg-primary/15 px-px text-primary">
        {text[idx]}
      </mark>,
    );
    lastIndex = idx + 1;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
