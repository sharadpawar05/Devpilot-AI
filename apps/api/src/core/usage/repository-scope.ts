export interface RepoScope {
  owner: string;
  repo: string;
}

/**
 * Parse an `owner/repo` reference into its two segments, mirroring the
 * `SPLIT_PART` semantics used by `countUserRepositories`.
 *
 * Returns null when the value is absent, has no separator, or has an empty
 * segment — such values are never counted against the repository quota, so
 * they need no enforcement.
 */
export function repoScopeFromString(value: unknown): RepoScope | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('/');
  if (parts.length < 2) return null;
  const owner = parts[0].trim();
  const repo = parts[1].trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

/** Same as `repoScopeFromString`, but for callers that carry owner/repo separately. */
export function repoScopeFromFields(owner: unknown, repo: unknown): RepoScope | null {
  if (typeof owner !== 'string' || typeof repo !== 'string') return null;
  const o = owner.trim();
  const r = repo.trim();
  if (!o || !r) return null;
  return { owner: o, repo: r };
}
