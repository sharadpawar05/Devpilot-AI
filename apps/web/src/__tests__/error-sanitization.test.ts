import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/lib/error-messages';

describe('Error Message Sanitization', () => {
  describe('getErrorMessage', () => {
    it('should return friendly message for REPOSITORY_LOAD_FAILED', () => {
      const result = getErrorMessage({ code: 'REPOSITORY_LOAD_FAILED' });

      expect(result.title).toBe('Unable to load repository');
      expect(result.message).not.toContain('prisma');
      expect(result.message).not.toContain('database');
      expect(result.message).not.toContain('connection pool');
      expect(result.retryable).toBe(true);
    });

    it('should return friendly message for REPOSITORY_NOT_FOUND', () => {
      const result = getErrorMessage({ code: 'REPOSITORY_NOT_FOUND' });

      expect(result.title).toBe('Repository not found');
      expect(result.message).not.toContain('404');
      expect(result.message).not.toContain('Not Found');
      expect(result.retryable).toBe(false);
    });

    it('should return friendly message for GITHUB_AUTH_FAILED', () => {
      const result = getErrorMessage({ code: 'GITHUB_AUTH_FAILED' });

      expect(result.title).toBe('GitHub authentication failed');
      expect(result.message).not.toContain('Bad credentials');
      expect(result.message).not.toContain('401');
      expect(result.retryable).toBe(false);
    });

    it('should return friendly message for GITHUB_RATE_LIMIT', () => {
      const result = getErrorMessage({ code: 'GITHUB_RATE_LIMIT' });

      expect(result.title).toBe('GitHub rate limit exceeded');
      expect(result.message).not.toContain('429');
      expect(result.message).not.toContain('Too Many Requests');
      expect(result.retryable).toBe(true);
    });

    it('should return friendly message for DATABASE_ERROR', () => {
      const result = getErrorMessage({ code: 'DATABASE_ERROR' });

      expect(result.title).toBe('Service error');
      expect(result.message).not.toContain('prisma');
      expect(result.message).not.toContain('query');
      expect(result.message).not.toContain('connection');
      expect(result.retryable).toBe(true);
    });

    it('should return friendly message for DATABASE_TIMEOUT', () => {
      const result = getErrorMessage({ code: 'DATABASE_TIMEOUT' });

      expect(result.title).toBe('Request timed out');
      expect(result.message).not.toContain('pool');
      expect(result.message).not.toContain('connection');
      expect(result.retryable).toBe(true);
    });

    it('should return friendly message for unknown errors', () => {
      const result = getErrorMessage({
        code: 'UNKNOWN_CODE',
        message: 'Some random error occurred',
      });

      expect(result.title).toBe('Something went wrong');
      expect(result.message).not.toContain('prisma');
      expect(result.message).not.toContain('database');
      expect(result.retryable).toBe(true);
    });

    it('should never expose raw error messages', () => {
      const dangerousMessages = [
        'Invalid db.user.findUnique() invocation',
        'Timed out fetching a new connection from the connection pool',
        'Error at /app/node_modules/prisma/client/runtime/index.js:123:45',
        'SELECT * FROM users WHERE id = $1',
        'Foreign key constraint failed on the field: userId',
        'Column "email" not found in table "users"',
        'ECONNREFUSED 127.0.0.1:5432',
        'TypeError: Cannot read property of undefined at src/services/repo.ts:145:23',
      ];

      for (const message of dangerousMessages) {
        const result = getErrorMessage({ code: 'UNKNOWN', message });

        // Verify no internal details are exposed
        expect(result.message).not.toContain('findUnique');
        expect(result.message).not.toContain('pool');
        expect(result.message).not.toContain('node_modules');
        expect(result.message).not.toContain('SELECT');
        expect(result.message).not.toContain('FROM users');
        expect(result.message).not.toContain('Foreign key');
        expect(result.message).not.toContain('Column');
        expect(result.message).not.toContain('ECONNREFUSED');
        expect(result.message).not.toContain('127.0.0.1');
        expect(result.message).not.toContain('.ts:');
        expect(result.message).not.toContain('.js:');
      }
    });

    it('should sanitize Gemini 429 quota errors for sprint summary', () => {
      const raw = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash Please retry in 41.206410223s. [{"@type":"type.googleapis.com/google.rpc.Help"}]`;

      const byCode = getErrorMessage({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please wait 42 seconds and try again.',
      });
      expect(byCode.title).toBe('Rate limit exceeded');
      expect(byCode.retryable).toBe(true);
      expect(byCode.message).not.toContain('GoogleGenerativeAI');
      expect(byCode.message).not.toContain('429');
      expect(byCode.message).not.toContain('generativelanguage');

      const byRawMessage = getErrorMessage({ code: 'GENERATION_FAILED', message: raw });
      expect(byRawMessage.title).toBe('Rate limit exceeded');
      expect(byRawMessage.message).not.toContain('GoogleGenerativeAI');
      expect(byRawMessage.message).not.toContain('generativelanguage.googleapis.com');
      expect(byRawMessage.message).not.toContain('quotaValue');
      expect(byRawMessage.suggestion).toContain('42');
    });

    it('should provide suggestions for retryable errors', () => {
      const retryableCodes = [
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMIT',
        'RATE_LIMIT_EXCEEDED',
        'GENERATION_FAILED',
        'DATABASE_ERROR',
        'DATABASE_TIMEOUT',
        'REPOSITORY_LOAD_FAILED',
        'GITHUB_RATE_LIMIT',
      ];

      for (const code of retryableCodes) {
        const result = getErrorMessage({ code });
        expect(result.retryable).toBe(true);
        expect(result.suggestion).toBeDefined();
        expect(result.suggestion!.length).toBeGreaterThan(0);
      }
    });

    it('should not provide retry button for non-retryable errors', () => {
      const nonRetryableCodes = [
        'REPOSITORY_NOT_FOUND',
        'GITHUB_AUTH_FAILED',
        'INVALID_API_KEY',
        'MODEL_NOT_FOUND',
      ];

      for (const code of nonRetryableCodes) {
        const result = getErrorMessage({ code });
        expect(result.retryable).toBe(false);
      }
    });
  });
});
