import { describe, it, expect } from 'vitest';
import { extractOAuthError, getOAuthErrorFromLocation, getAuthErrorCopy } from '@/lib/auth-error';

describe('extractOAuthError', () => {
  it('returns null when there is no error param', () => {
    expect(extractOAuthError(new URLSearchParams('foo=bar'))).toBeNull();
  });

  it('extracts error, code, and description', () => {
    const result = extractOAuthError(
      new URLSearchParams(
        'error=server_error&error_code=unexpected_failure&error_description=boom',
      ),
    );
    expect(result).toEqual({
      error: 'server_error',
      errorCode: 'unexpected_failure',
      errorDescription: 'boom',
    });
  });
});

describe('getOAuthErrorFromLocation', () => {
  it('extracts the error from the query string', () => {
    const result = getOAuthErrorFromLocation('?error=access_denied', '');
    expect(result?.error).toBe('access_denied');
  });

  it('extracts the error from the hash fragment', () => {
    const result = getOAuthErrorFromLocation(
      '',
      '#error=access_denied&error_description=User+denied+access',
    );
    expect(result).toEqual({
      error: 'access_denied',
      errorCode: null,
      errorDescription: 'User denied access',
    });
  });

  it('prefers the query string over the hash', () => {
    const result = getOAuthErrorFromLocation('?error=from_query', '#error=from_hash');
    expect(result?.error).toBe('from_query');
  });

  it('returns null for a successful token hash', () => {
    expect(
      getOAuthErrorFromLocation('', '#access_token=abc123&token_type=bearer&expires_in=3600'),
    ).toBeNull();
  });

  it('returns null when there are no params at all', () => {
    expect(getOAuthErrorFromLocation('', '')).toBeNull();
  });
});

describe('getAuthErrorCopy', () => {
  it('maps known error codes to friendly copy', () => {
    const copy = getAuthErrorCopy({
      error: 'access_denied',
      errorCode: null,
      errorDescription: null,
    });
    expect(copy.title).toBe('Sign-in cancelled');
    expect(copy.message).toMatch(/cancelled or denied/i);
  });

  it('prefers error_code over error', () => {
    const copy = getAuthErrorCopy({
      error: 'server_error',
      errorCode: 'session_expired',
      errorDescription: null,
    });
    expect(copy.title).toBe('Session expired');
  });

  it('is case-insensitive on error codes', () => {
    const copy = getAuthErrorCopy({
      error: 'ACCESS_DENIED',
      errorCode: null,
      errorDescription: null,
    });
    expect(copy.title).toBe('Sign-in cancelled');
  });

  it('falls back to the sanitized description for unknown errors', () => {
    const copy = getAuthErrorCopy({
      error: 'some_unknown_error',
      errorCode: null,
      errorDescription: 'Account sync failed at https://example.com/oauth/callback',
    });
    expect(copy.title).toBe('Sign-in failed');
    expect(copy.message).toBe('Account sync failed at');
  });

  it('uses generic copy when there is no usable description', () => {
    const copy = getAuthErrorCopy({
      error: 'some_unknown_error',
      errorCode: null,
      errorDescription: 'https://example.com',
    });
    expect(copy.message).toBe('Something went wrong while signing you in. Please try again.');
  });

  it('uses generic copy when there are no params', () => {
    expect(getAuthErrorCopy(null)).toEqual({
      title: 'Sign-in failed',
      message: 'Something went wrong while signing you in. Please try again.',
    });
  });
});
