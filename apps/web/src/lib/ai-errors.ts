/**
 * AI Error Handling Utilities
 *
 * Provides friendly error messages for AI-related errors.
 */

export interface AIError {
  code?: string;
  message?: string;
  statusCode?: number;
}

export interface FriendlyError {
  title: string;
  message: string;
  technicalDetails?: string;
  retryable: boolean;
}

/**
 * Map error codes to friendly messages
 */
const ERROR_MESSAGES: Record<string, { title: string; message: string; retryable: boolean }> = {
  AUTHENTICATION_ERROR: {
    title: 'Authentication Failed',
    message:
      'Unable to authenticate with the AI provider. Please check your API key configuration.',
    retryable: false,
  },
  RATE_LIMIT_EXCEEDED: {
    title: 'Rate Limit Exceeded',
    message: 'Too many requests. Please wait a moment and try again.',
    retryable: true,
  },
  INVALID_REQUEST: {
    title: 'Invalid Request',
    message: 'The request was invalid. Please check your input and try again.',
    retryable: false,
  },
  MODEL_NOT_FOUND: {
    title: 'Model Not Available',
    message: 'The selected AI model is not available. Please choose a different model.',
    retryable: false,
  },
  CONTEXT_LENGTH_EXCEEDED: {
    title: 'Input Too Long',
    message: "The input exceeds the model's context length limit. Please reduce the input size.",
    retryable: false,
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to the AI provider. Please check your internet connection.',
    retryable: true,
  },
  TIMEOUT: {
    title: 'Request Timed Out',
    message: 'The request took too long to complete. Please try again.',
    retryable: true,
  },
  PROVIDER_UNAVAILABLE: {
    title: 'Provider Unavailable',
    message:
      'The AI provider is currently unavailable. Please try again later or use a different provider.',
    retryable: true,
  },
  NOT_IMPLEMENTED: {
    title: 'Not Supported',
    message: 'This feature is not yet supported for the selected provider.',
    retryable: false,
  },
  STREAM_ERROR: {
    title: 'Streaming Error',
    message: 'An error occurred while streaming the response. Please try again.',
    retryable: true,
  },
  UNKNOWN_ERROR: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
  },
};

/**
 * Default error message for unknown errors
 */
const DEFAULT_ERROR = {
  title: 'Unable to Generate Response',
  message: 'An error occurred while generating the response. Please try again.',
  retryable: true,
};

/**
 * Convert a raw error to a friendly error message
 */
export function getFriendlyError(error: AIError | Error | unknown): FriendlyError {
  // Handle null/undefined
  if (!error) {
    return { ...DEFAULT_ERROR, technicalDetails: 'No error information available' };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for common error patterns
    if (message.includes('rate limit') || message.includes('429')) {
      return { ...ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, technicalDetails: error.message };
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return { ...ERROR_MESSAGES.TIMEOUT, technicalDetails: error.message };
    }
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnrefused')
    ) {
      return { ...ERROR_MESSAGES.NETWORK_ERROR, technicalDetails: error.message };
    }
    if (
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('api key')
    ) {
      return { ...ERROR_MESSAGES.AUTHENTICATION_ERROR, technicalDetails: error.message };
    }
    if (message.includes('not found') || message.includes('404')) {
      return { ...ERROR_MESSAGES.MODEL_NOT_FOUND, technicalDetails: error.message };
    }
    if (message.includes('context length') || message.includes('too long')) {
      return { ...ERROR_MESSAGES.CONTEXT_LENGTH_EXCEEDED, technicalDetails: error.message };
    }
    if (message.includes('not implemented')) {
      return { ...ERROR_MESSAGES.NOT_IMPLEMENTED, technicalDetails: error.message };
    }

    return {
      ...DEFAULT_ERROR,
      technicalDetails: error.message,
    };
  }

  // Handle objects with code/message properties
  if (typeof error === 'object' && error !== null) {
    const err = error as AIError;

    if (err.code && ERROR_MESSAGES[err.code]) {
      return {
        ...ERROR_MESSAGES[err.code],
        technicalDetails: err.message,
      };
    }

    if (err.message) {
      return {
        ...DEFAULT_ERROR,
        technicalDetails: err.message,
      };
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      ...DEFAULT_ERROR,
      technicalDetails: error,
    };
  }

  return {
    ...DEFAULT_ERROR,
    technicalDetails: String(error),
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: AIError | Error | unknown): boolean {
  const friendlyError = getFriendlyError(error);
  return friendlyError.retryable;
}

/**
 * Get error title for display
 */
export function getErrorTitle(error: AIError | Error | unknown): string {
  return getFriendlyError(error).title;
}

/**
 * Get error message for display
 */
export function getErrorMessage(error: AIError | Error | unknown): string {
  return getFriendlyError(error).message;
}

/**
 * Get technical details for development/debugging
 */
export function getErrorTechnicalDetails(error: AIError | Error | unknown): string | undefined {
  return getFriendlyError(error).technicalDetails;
}
