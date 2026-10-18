import { z } from 'zod';

/**
 * Shared validation for GitHub repository identifiers that flow into
 * Octokit URL path segments. Restricting the character set prevents
 * path-segment injection (embedded `/`, `..`, `%2F`, query/fragment
 * characters) into requests made with the caller's GitHub token.
 */

// GitHub logins: alphanumeric and hyphens, cannot start/end with a hyphen,
// max 39 characters (both users and organizations).
export const GITHUB_OWNER_PATTERN = '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$';

// GitHub repository names: letters, digits, hyphens, underscores, dots.
export const GITHUB_REPO_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$';

// Git branch names may contain `/` (e.g. feature/foo) but must not enable
// path traversal or absolute-path injection.
export const GITHUB_BRANCH_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$';

export const githubOwnerSchema = z
  .string()
  .min(1)
  .max(39)
  .regex(new RegExp(GITHUB_OWNER_PATTERN), 'Owner must be a valid GitHub username or organization');

export const githubRepoSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(new RegExp(GITHUB_REPO_PATTERN), 'Repository must be a valid GitHub repository name')
  .refine((v) => !v.includes('..'), 'Repository must be a valid GitHub repository name');

export const githubBranchSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(new RegExp(GITHUB_BRANCH_PATTERN), 'Branch contains invalid characters')
  .refine(
    (v) =>
      !v.includes('..') &&
      !v.includes('//') &&
      !v.startsWith('/') &&
      !v.startsWith('.') &&
      !v.endsWith('/') &&
      !v.endsWith('.'),
    'Branch must be a valid git branch name',
  );

function containsControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

// File path inside a repository. Slashes are allowed; control characters,
// absolute paths, and `..` segments are not.
export const repoFilePathSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine((v) => !containsControlCharacters(v), 'Path contains invalid characters')
  .refine(
    (v) => !v.startsWith('/') && !v.split('/').includes('..'),
    'Path must be a relative file path inside the repository',
  );
