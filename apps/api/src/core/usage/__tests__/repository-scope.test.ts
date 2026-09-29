import { describe, it, expect } from 'vitest';
import { repoScopeFromString, repoScopeFromFields } from '@/core/usage/repository-scope';

describe('repoScopeFromString', () => {
  it('splits a well-formed owner/repo reference', () => {
    expect(repoScopeFromString('octo/api')).toEqual({ owner: 'octo', repo: 'api' });
  });

  it('trims whitespace around segments', () => {
    expect(repoScopeFromString('  octo / api  ')).toEqual({ owner: 'octo', repo: 'api' });
  });

  it('mirrors SPLIT_PART semantics for deeper paths', () => {
    expect(repoScopeFromString('octo/api/sub')).toEqual({ owner: 'octo', repo: 'api' });
  });

  it('returns null for values the repository counter never counts', () => {
    expect(repoScopeFromString(undefined)).toBeNull();
    expect(repoScopeFromString(null)).toBeNull();
    expect(repoScopeFromString(42)).toBeNull();
    expect(repoScopeFromString('no-separator')).toBeNull();
    expect(repoScopeFromString('/api')).toBeNull();
    expect(repoScopeFromString('octo/')).toBeNull();
    expect(repoScopeFromString('   /   ')).toBeNull();
  });
});

describe('repoScopeFromFields', () => {
  it('combines separate owner and repo fields', () => {
    expect(repoScopeFromFields('octo', 'api')).toEqual({ owner: 'octo', repo: 'api' });
    expect(repoScopeFromFields(' octo ', ' api ')).toEqual({ owner: 'octo', repo: 'api' });
  });

  it('returns null when either field is missing or not a string', () => {
    expect(repoScopeFromFields('octo', undefined)).toBeNull();
    expect(repoScopeFromFields(undefined, 'api')).toBeNull();
    expect(repoScopeFromFields('octo', '')).toBeNull();
    expect(repoScopeFromFields('', 'api')).toBeNull();
    expect(repoScopeFromFields(1, 'api')).toBeNull();
  });
});
