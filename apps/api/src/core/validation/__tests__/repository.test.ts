import { describe, it, expect } from 'vitest';
import {
  githubOwnerSchema,
  githubRepoSchema,
  githubBranchSchema,
  repoFilePathSchema,
} from '@/core/validation/repository';

describe('GitHub repository input validation', () => {
  it('accepts valid owners, repos, and branches', () => {
    expect(githubOwnerSchema.safeParse('octocat').success).toBe(true);
    expect(githubOwnerSchema.safeParse('my-org-1').success).toBe(true);
    expect(githubRepoSchema.safeParse('hello-world').success).toBe(true);
    expect(githubRepoSchema.safeParse('my_repo.js').success).toBe(true);
    expect(githubBranchSchema.safeParse('main').success).toBe(true);
    expect(githubBranchSchema.safeParse('feature/login-flow').success).toBe(true);
    expect(repoFilePathSchema.safeParse('src/app/index.ts').success).toBe(true);
  });

  it('rejects path-segment injection in owner and repo', () => {
    expect(githubOwnerSchema.safeParse('octo/repos').success).toBe(false);
    expect(githubOwnerSchema.safeParse('..').success).toBe(false);
    expect(githubOwnerSchema.safeParse('-leading').success).toBe(false);
    expect(githubOwnerSchema.safeParse('a'.repeat(40)).success).toBe(false);
    expect(githubRepoSchema.safeParse('repo?token=x').success).toBe(false);
    expect(githubRepoSchema.safeParse('repo#frag').success).toBe(false);
    expect(githubRepoSchema.safeParse('..').success).toBe(false);
  });

  it('rejects traversal and absolute paths in branch and file path', () => {
    expect(githubBranchSchema.safeParse('../main').success).toBe(false);
    expect(githubBranchSchema.safeParse('/main').success).toBe(false);
    expect(githubBranchSchema.safeParse('main/../../x').success).toBe(false);
    expect(githubBranchSchema.safeParse('main//x').success).toBe(false);
    expect(repoFilePathSchema.safeParse('/etc/passwd').success).toBe(false);
    expect(repoFilePathSchema.safeParse('a/../../b').success).toBe(false);
    expect(repoFilePathSchema.safeParse('bad' + String.fromCharCode(0) + 'path').success).toBe(
      false,
    );
  });
});
