interface ErrorMessageConfig {
  title: string;
  message: string;
  retryable: boolean;
  suggestion?: string;
}

const ERROR_MESSAGES: Record<string, ErrorMessageConfig> = {
  NETWORK_ERROR: {
    title: 'Connection lost',
    message: 'Unable to connect to the server.',
    retryable: true,
    suggestion: 'Check your internet connection and try again.',
  },
  TIMEOUT: {
    title: 'Request timed out',
    message: 'The AI took too long to respond.',
    retryable: true,
    suggestion: 'Try a shorter prompt or switch to a faster model.',
  },
  RATE_LIMIT: {
    title: 'Rate limit exceeded',
    message: 'Too many requests to the AI provider.',
    retryable: true,
    suggestion: 'Wait a moment and try again.',
  },
  RATE_LIMIT_EXCEEDED: {
    title: 'Rate limit exceeded',
    message: 'Too many requests to the AI provider.',
    retryable: true,
    suggestion: 'Wait a moment and try again.',
  },
  GENERATION_FAILED: {
    title: 'Generation failed',
    message: 'Failed to generate the AI summary.',
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  INVALID_API_KEY: {
    title: 'Invalid API key',
    message: 'The API key for this provider is invalid or missing.',
    retryable: false,
    suggestion: 'Check your API key configuration in Settings.',
  },
  MODEL_NOT_FOUND: {
    title: 'Model not available',
    message: 'The selected model is not available.',
    retryable: false,
    suggestion: 'Choose a different model from the dropdown.',
  },
  CONTEXT_LENGTH_EXCEEDED: {
    title: 'Prompt too long',
    message: 'Your prompt exceeds the maximum length for this model.',
    retryable: false,
    suggestion: 'Shorten your prompt or use a model with larger context.',
  },
  PROVIDER_UNAVAILABLE: {
    title: 'Provider unavailable',
    message: 'The AI provider is currently unavailable.',
    retryable: true,
    suggestion: 'Try a different provider or wait and retry.',
  },
  VALIDATION_ERROR: {
    title: 'Invalid request',
    message: 'The request contains invalid parameters.',
    retryable: false,
    suggestion: 'Check your input and try again.',
  },
  STREAM_ERROR: {
    title: 'Stream interrupted',
    message: 'The response stream was interrupted.',
    retryable: true,
    suggestion: 'Try generating the response again.',
  },
  UNKNOWN_ERROR: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred.',
    retryable: true,
    suggestion: 'Try again or switch to a different model.',
  },
  AUTH_EXPIRED: {
    title: 'Session expired',
    message: 'Your session has expired.',
    retryable: false,
    suggestion: 'Please log in again.',
  },
  UNAUTHORIZED: {
    title: 'Unauthorized',
    message: 'You are not authorized to perform this action.',
    retryable: false,
    suggestion: 'Please log in again.',
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'The requested resource was not found.',
    retryable: false,
  },
  HTTP_ERROR: {
    title: 'Server error',
    message: 'The server returned an error.',
    retryable: true,
    suggestion: 'Try again in a few moments.',
  },
  NO_READER: {
    title: 'Response error',
    message: 'Could not read the server response.',
    retryable: true,
    suggestion: 'Try again.',
  },
  // Repository-specific error codes
  REPOSITORY_LOAD_FAILED: {
    title: 'Unable to load repository',
    message: "We couldn't retrieve the repository information right now.",
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  REPOSITORY_NOT_FOUND: {
    title: 'Repository not found',
    message: 'The repository could not be found.',
    retryable: false,
    suggestion: 'Check the repository name and make sure it exists.',
  },
  GITHUB_AUTH_FAILED: {
    title: 'GitHub authentication failed',
    message: "We couldn't authenticate with GitHub.",
    retryable: false,
    suggestion: 'Please log in again to reconnect your GitHub account.',
  },
  GITHUB_RATE_LIMIT: {
    title: 'GitHub rate limit exceeded',
    message: 'Too many requests to GitHub.',
    retryable: true,
    suggestion: 'Wait a few minutes and try again.',
  },
  DATABASE_ERROR: {
    title: 'Service error',
    message: 'Unable to load repository information.',
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  DATABASE_TIMEOUT: {
    title: 'Request timed out',
    message: 'The request took too long to complete.',
    retryable: true,
    suggestion: 'Please try again.',
  },
  SERVICE_UNAVAILABLE: {
    title: 'Service unavailable',
    message: 'Unable to connect to the service.',
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  TREE_LOAD_FAILED: {
    title: 'Unable to load file structure',
    message: "We couldn't retrieve the repository file structure.",
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  FILE_LOAD_FAILED: {
    title: 'Unable to load file',
    message: "We couldn't retrieve the file content.",
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  CONTRIBUTORS_LOAD_FAILED: {
    title: 'Unable to load contributors',
    message: "We couldn't retrieve the contributors list.",
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  ANALYSIS_FAILED: {
    title: 'Unable to analyze repository',
    message: "We couldn't analyze the repository technology stack.",
    retryable: true,
    suggestion: 'Please try again in a few moments.',
  },
  GENERATION_ERROR: {
    title: 'Generation failed',
    message: 'Failed to generate the artifact.',
    retryable: true,
    suggestion: 'Please try again.',
  },
  AI_ERROR: {
    title: 'AI error',
    message: 'Failed to generate the AI summary.',
    retryable: true,
    suggestion: 'Please try again.',
  },
  USAGE_LIMIT_REACHED: {
    title: 'Usage limit reached',
    message: 'You have reached your plan usage limit for this feature.',
    retryable: false,
    suggestion: 'Upgrade your plan or wait until the next billing period.',
  },
  PLAN_LIMIT_REACHED: {
    title: 'Usage limit reached',
    message: 'You have reached your plan usage limit for this feature.',
    retryable: false,
    suggestion: 'Upgrade your plan or wait until the next billing period.',
  },
};

const DEFAULT_ERROR: ErrorMessageConfig = {
  title: 'Something went wrong',
  message: 'An unexpected error occurred.',
  retryable: true,
  suggestion: 'Try again or switch to a different model.',
};

function cleanErrorMessage(message: string): string {
  // Remove provider-specific prefixes like [GoogleGenerativeAI Error]:
  let cleaned = message.replace(/^\[.*?\]\s*:?\s*/i, '');

  // Remove HTTP status codes and URLs
  cleaned = cleaned.replace(/\[\d{3}\s+.*?\]\s*/g, '');
  cleaned = cleaned.replace(/https?:\/\/\S+/g, '');

  // Remove JSON-like structures at the end
  cleaned = cleaned.replace(/\s*\[?\{.*$/s, '');

  // Remove "For more information..." paragraphs
  cleaned = cleaned.replace(/For more information.*$/i, '');

  // Remove internal error details that should never be exposed
  // Prisma/Database errors
  cleaned = cleaned.replace(/Invalid\s+db\.\w+\.\w+\(\)\s+invocation.*$/is, '');
  cleaned = cleaned.replace(/PrismaClient\w*Error.*$/is, '');
  cleaned = cleaned.replace(/connection\s+pool.*$/is, '');
  cleaned = cleaned.replace(/timed?\s*out\s+fetching.*$/is, '');

  // Stack traces with file paths
  cleaned = cleaned.replace(/\s*at\s+\/.*$/gm, '');
  cleaned = cleaned.replace(/\s*at\s+\w+\s+\/.*$/gm, '');

  // File path references
  cleaned = cleaned.replace(/\/[\w/.-]+\.(ts|js|tsx|jsx):\d+:\d+/g, '');
  cleaned = cleaned.replace(/node_modules\/.*/g, '');

  // SQL/Database query details
  cleaned = cleaned.replace(/SELECT\s+.*$/is, '');
  cleaned = cleaned.replace(/INSERT\s+.*$/is, '');
  cleaned = cleaned.replace(/UPDATE\s+.*$/is, '');
  cleaned = cleaned.replace(/DELETE\s+.*$/is, '');
  cleaned = cleaned.replace(/FROM\s+[\w"']+\s+WHERE.*$/is, '');
  cleaned = cleaned.replace(/relation\s+["']?\w+["']?\s+does\s+not\s+exist.*$/is, '');
  cleaned = cleaned.replace(/column\s+["']?\w+["']?\s+not\s+found.*$/is, '');
  cleaned = cleaned.replace(/foreign\s+key\s+constraint.*$/is, '');
  cleaned = cleaned.replace(/unique\s+constraint.*$/is, '');

  // Network errors with internal details
  cleaned = cleaned.replace(/ECONNREFUSED\s+[\d:.]+/g, '');
  cleaned = cleaned.replace(/ENOTFOUND\s+\w+/g, '');

  // Trim and limit length
  cleaned = cleaned.trim();
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + '...';
  }

  // If the message is now empty or too short, return a generic message
  if (cleaned.length < 5) {
    return 'An unexpected error occurred.';
  }

  return cleaned;
}

export function getErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
): ErrorMessageConfig {
  if (!error) return DEFAULT_ERROR;

  const code = error.code ?? 'UNKNOWN_ERROR';
  const message = error.message ?? '';
  const lower = message.toLowerCase();

  const isRateLimitCode =
    code === 'STREAM_ERROR' || code === 'RATE_LIMIT_EXCEEDED' || code === 'RATE_LIMIT';
  const isRateLimitMessage =
    message.includes('429') ||
    message.includes('Too Many Requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota');

  if (isRateLimitCode || isRateLimitMessage) {
    // Quota exceeded (no retry delay) gets its own copy
    if (
      (code === 'STREAM_ERROR' || isRateLimitMessage) &&
      lower.includes('quota') &&
      !/retry/i.test(message)
    ) {
      return {
        title: 'Quota exceeded',
        message: 'You have exceeded your API quota for this provider.',
        retryable: true,
        suggestion: 'Wait a moment and try again, or upgrade your plan.',
      };
    }

    const retryMatch = message.match(/(?:retry in|retry after|wait)\s+(\d+\.?\d*)\s*s/i);
    const retrySeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : undefined;
    const config =
      code === 'GITHUB_RATE_LIMIT'
        ? ERROR_MESSAGES.GITHUB_RATE_LIMIT
        : ERROR_MESSAGES.RATE_LIMIT_EXCEEDED;
    return {
      title: config.title,
      message: config.message,
      retryable: true,
      suggestion: retrySeconds
        ? `Please wait ${retrySeconds} seconds and try again.`
        : (config.suggestion ?? 'Wait a moment and try again.'),
    };
  }

  const config = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN_ERROR;

  // For known error codes, use the friendly message from config
  if (ERROR_MESSAGES[code]) {
    return config;
  }

  // For unknown errors, try to extract a cleaner message
  return {
    ...config,
    message: cleanErrorMessage(message) || config.message,
  };
}

export function isRetryableError(error: { code?: string } | null | undefined): boolean {
  if (!error) return false;
  const config = ERROR_MESSAGES[error.code ?? ''];
  return config?.retryable ?? true;
}
