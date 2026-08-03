import type { ReactNode } from 'react';

export interface FuzzyMatch {
  score: number;
  indices: number[];
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (q.length === 0) return { score: 0, indices: [] };
  if (q.length > t.length) return null;

  let qi = 0;
  let score = 0;
  const indices: number[] = [];

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      // Bonus for consecutive matches and start of word
      if (ti === 0 || text[ti - 1] === ' ' || text[ti - 1] === '-') {
        score += 10;
      } else {
        score += 1;
      }
      qi++;
    }
  }

  return qi === q.length ? { score, indices } : null;
}

export function highlightMatches(text: string, indices: number[]): ReactNode[] {
  if (indices.length === 0) return [text];

  const result: ReactNode[] = [];
  let lastIndex = 0;

  for (const idx of indices) {
    if (idx > lastIndex) {
      result.push(text.slice(lastIndex, idx));
    }
    result.push(
      <mark key={idx} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
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
