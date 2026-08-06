/**
 * Error sanitization utilities
 *
 * Prevents internal error details (stack traces, SQL queries, file paths, etc.)
 * from being exposed to clients. Logs full errors server-side only.
 */

export interface SanitizedError {
  code: string;
  message: string;
  statusCode: number;
}

// Patterns that indicate internal errors that should never be exposed
const INTERNAL_ERROR_PATTERNS = [
  /prisma/i,
  /database/i,
  /connection pool/i,
  /query/i,
  /sql/i,
  /column/i,
  /table/i,
  /constraint/i,
  /foreign key/i,
  /unique constraint/i,
  /at \//i, // stack traces with file paths
  /node_modules/i,
  /\.ts:\d+:\d+/i, // TypeScript file references
  /\.js:\d+:\d+/i, // JavaScript file references
  /timeout.*exceeded/i,
  /pool.*timeout/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ENOMEM/i,
];

// Known error patterns and their user-friendly mappings
const ERROR_MAPPINGS: Array<{
  pattern: RegExp;
  code: string;
  message: string;
  statusCode: number;
}> = [
  // GitHub API errors
  {
    pattern: /Not Found/i,
    code: 'REPOSITORY_NOT_FOUND',
    message: 'Repository not found. It may be private or does not exist.',
    statusCode: 404,
  },
  {
    pattern: /Bad credentials/i,
    code: 'GITHUB_AUTH_FAILED',
    message: 'GitHub authentication failed. Please log in again.',
    statusCode: 401,
  },
  {
    pattern: /rate limit/i,
    code: 'GITHUB_RATE_LIMIT',
    message: 'GitHub API rate limit exceeded. Please try again later.',
    statusCode: 429,
  },
  {
    pattern: /maximum number of login attempts/i,
    code: 'GITHUB_RATE_LIMIT',
    message: 'GitHub API rate limit exceeded. Please try again later.',
    statusCode: 429,
  },
  // Database errors
  {
    pattern: /connection pool/i,
    code: 'DATABASE_ERROR',
    message: 'Unable to load repository information.',
    statusCode: 503,
  },
  {
    pattern: /timeout.*exceeded/i,
    code: 'DATABASE_TIMEOUT',
    message: 'The request timed out. Please try again.',
    statusCode: 504,
  },
  {
    pattern: /prisma/i,
    code: 'DATABASE_ERROR',
    message: 'Unable to load repository information.',
    statusCode: 500,
  },
  // Network errors
  {
    pattern: /ECONNREFUSED/i,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Unable to connect to the service. Please try again later.',
    statusCode: 503,
  },
  {
    pattern: /ENOTFOUND/i,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Unable to connect to the service. Please try again later.',
    statusCode: 503,
  },
  {
    pattern: /fetch failed/i,
    code: 'NETWORK_ERROR',
    message: 'Network error occurred. Please check your connection.',
    statusCode: 502,
  },
];

/**
 * Checks if an error message contains internal details that should not be exposed
 */
function containsInternalDetails(message: string): boolean {
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Attempts to map an error to a known error type with a user-friendly message
 */
function mapToKnownError(
  message: string,
): { code: string; message: string; statusCode: number } | null {
  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(message)) {
      return {
        code: mapping.code,
        message: mapping.message,
        statusCode: mapping.statusCode,
      };
    }
  }
  return null;
}

/**
 * Sanitizes an error for client exposure
 *
 * @param error - The original error (may be any type)
 * @param fallbackCode - Default error code if no mapping found
 * @param fallbackMessage - Default message if no mapping found
 * @param fallbackStatusCode - Default HTTP status code if no mapping found
 * @returns Sanitized error safe for client exposure
 */
export function sanitizeError(
  error: unknown,
  fallbackCode: string = 'REPOSITORY_LOAD_FAILED',
  fallbackMessage: string = 'Unable to load repository information.',
  fallbackStatusCode: number = 500,
): SanitizedError {
  // Extract message from error
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

  // Log the full error server-side
  console.error('[Repository Overview Error]', {
    message: rawMessage,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  // Check if the raw message contains internal details
  if (containsInternalDetails(rawMessage)) {
    // Try to map to a known error first
    const mapped = mapToKnownError(rawMessage);
    if (mapped) {
      return mapped;
    }
    // Return generic message for internal errors
    return {
      code: fallbackCode,
      message: fallbackMessage,
      statusCode: fallbackStatusCode,
    };
  }

  // For errors without internal details, still try to map them
  const mapped = mapToKnownError(rawMessage);
  if (mapped) {
    return mapped;
  }

  // For truly unknown errors, return a generic message
  return {
    code: fallbackCode,
    message: fallbackMessage,
    statusCode: fallbackStatusCode,
  };
}

/**
 * Creates a sanitized error response object for API responses
 */
export function createErrorResponse(
  error: unknown,
  fallbackCode?: string,
  fallbackMessage?: string,
  fallbackStatusCode?: number,
): { success: false; error: { code: string; message: string } } {
  const sanitized = sanitizeError(error, fallbackCode, fallbackMessage, fallbackStatusCode);
  return {
    success: false,
    error: {
      code: sanitized.code,
      message: sanitized.message,
    },
  };
}
