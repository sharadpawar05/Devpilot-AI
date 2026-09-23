export const RECENT_SEARCHES_KEY = 'devpilot_recent_searches';
const MAX_RECENT_SEARCHES = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches();

  const next = [trimmed, ...getRecentSearches().filter((item) => item !== trimmed)].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  return next;
}

export function removeRecentSearch(query: string): string[] {
  const next = getRecentSearches().filter((item) => item !== query);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}

export function clearRecentSearches(): string[] {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    /* noop */
  }
  return [];
}
