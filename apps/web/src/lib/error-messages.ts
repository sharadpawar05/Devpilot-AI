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

  // Trim and limit length
  cleaned = cleaned.trim();
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + '...';
  }

  return cleaned;
}

export function getErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
): ErrorMessageConfig {
  if (!error) return DEFAULT_ERROR;

  const code = error.code ?? 'UNKNOWN_ERROR';
  const message = error.message ?? '';

  // Detect rate limit from message patterns (Google, OpenAI, Anthropic all use 429)
  if (
    code === 'STREAM_ERROR' &&
    (message.includes('429') ||
      message.includes('Too Many Requests') ||
      message.includes('rate limit') ||
      message.includes('quota'))
  ) {
    const retryMatch = message.match(/retry in (\d+\.?\d*)s/);
    const retrySeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : undefined;
    return {
      title: 'Rate limit exceeded',
      message: 'Too many requests to the AI provider.',
      retryable: true,
      suggestion: retrySeconds
        ? `Please wait ${retrySeconds} seconds and try again.`
        : 'Wait a moment and try again.',
    };
  }

  // Detect quota exceeded from message patterns
  if (code === 'STREAM_ERROR' && (message.includes('quota') || message.includes('Quota'))) {
    return {
      title: 'Quota exceeded',
      message: 'You have exceeded your API quota for this provider.',
      retryable: true,
      suggestion: 'Wait a moment and try again, or upgrade your plan.',
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
