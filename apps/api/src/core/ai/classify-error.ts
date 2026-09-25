export interface AIErrorResponse {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
}

const CODE_STATUS: Record<string, number> = {
  RATE_LIMIT_EXCEEDED: 429,
  AUTHENTICATION_ERROR: 401,
  INVALID_API_KEY: 401,
  MODEL_NOT_FOUND: 400,
  CONTEXT_LENGTH_EXCEEDED: 400,
  INVALID_REQUEST: 400,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_NOT_IMPLEMENTED: 501,
  NOT_IMPLEMENTED: 501,
  TIMEOUT: 504,
  NETWORK_ERROR: 502,
  STREAM_ERROR: 502,
  RETRY_ERROR: 502,
  NO_RESULT: 502,
  AI_ERROR: 502,
  UNKNOWN_ERROR: 502,
};

const AI_ERROR_CODES = new Set(Object.keys(CODE_STATUS));

export function classifyAIError(error: unknown): AIErrorResponse {
  if (error && typeof error === 'object') {
    const structured = error as {
      code?: unknown;
      message?: unknown;
      retryable?: unknown;
      statusCode?: number;
    };
    const code = typeof structured.code === 'string' ? structured.code : undefined;
    const message =
      typeof structured.message === 'string' && structured.message
        ? structured.message
        : error instanceof Error
          ? error.message
          : String(error);

    if (code && AI_ERROR_CODES.has(code) && code !== 'UNKNOWN_ERROR' && code !== 'AI_ERROR') {
      const status = structured.statusCode ?? CODE_STATUS[code] ?? 502;
      const friendly = isRequestTooLarge(message)
        ? REQUEST_TOO_LARGE_MESSAGE
        : messageForCode(code);
      const clean = cleanAIErrorMessage(message);
      return {
        status,
        code,
        message: friendly || clean || message,
        retryable: structured.retryable !== false,
      };
    }

    return classifyByMessage(message);
  }

  return classifyByMessage(String(error));
}

const REQUEST_TOO_LARGE_MESSAGE =
  'The request is too large for this AI provider. Try reviewing fewer files or a different provider.';

function isRequestTooLarge(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('request too large') ||
    lower.includes('input tokens per minute') ||
    lower.includes('itpm')
  );
}

function messageForCode(code: string): string | undefined {
  switch (code) {
    case 'RATE_LIMIT_EXCEEDED':
      return 'Rate limit exceeded. Please wait a moment and try again.';
    case 'AUTHENTICATION_ERROR':
    case 'INVALID_API_KEY':
      return 'Invalid API key. Please check your provider settings.';
    case 'MODEL_NOT_FOUND':
      return 'The selected model is not available. Please try a different provider.';
    case 'PROVIDER_UNAVAILABLE':
      return 'The selected AI provider is not configured or unavailable.';
    case 'TIMEOUT':
      return 'The AI provider timed out. Please try again.';
    case 'NETWORK_ERROR':
      return 'Could not reach the AI provider. Please try again.';
    case 'CONTEXT_LENGTH_EXCEEDED':
      return 'The content is too long for the AI model. Try reviewing fewer files.';
    case 'NOT_IMPLEMENTED':
    case 'PROVIDER_NOT_IMPLEMENTED':
      return 'This provider is not yet implemented. Please try a different one.';
    case 'INVALID_REQUEST':
      return 'The AI provider rejected the request. Please adjust your input and try again.';
    default:
      return undefined;
  }
}

function classifyByMessage(rawMessage: string): AIErrorResponse {
  const lowerMsg = rawMessage.toLowerCase();

  if (
    lowerMsg.includes('429') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('resource_exhausted')
  ) {
    const retrySeconds = extractRetrySeconds(rawMessage);
    return {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: retrySeconds
        ? `Rate limit exceeded. Please wait ${retrySeconds} seconds and try again.`
        : 'Rate limit exceeded. Please wait a moment and try again.',
      retryable: true,
    };
  }

  if (lowerMsg.includes('invalid api key') || lowerMsg.includes('unauthorized')) {
    return {
      status: 401,
      code: 'INVALID_API_KEY',
      message: 'Invalid API key. Please check your provider settings.',
      retryable: false,
    };
  }

  if (lowerMsg.includes('model not found') || lowerMsg.includes('not found')) {
    return {
      status: 400,
      code: 'MODEL_NOT_FOUND',
      message: 'The selected model is not available. Please try a different provider.',
      retryable: false,
    };
  }

  if (lowerMsg.includes('context length') || lowerMsg.includes('too long')) {
    return {
      status: 400,
      code: 'CONTEXT_LENGTH_EXCEEDED',
      message: 'The content is too long for the AI model. Try reviewing fewer files.',
      retryable: false,
    };
  }

  if (lowerMsg.includes('not implemented')) {
    return {
      status: 501,
      code: 'NOT_IMPLEMENTED',
      message: 'This provider is not yet implemented. Please try a different one.',
      retryable: false,
    };
  }

  if (isRequestTooLarge(rawMessage)) {
    return {
      status: 413,
      code: 'INVALID_REQUEST',
      message: REQUEST_TOO_LARGE_MESSAGE,
      retryable: false,
    };
  }

  const cleanMessage = cleanAIErrorMessage(rawMessage);
  return {
    status: 502,
    code: 'AI_ERROR',
    message: cleanMessage || 'An error occurred with the AI provider. Please try again.',
    retryable: true,
  };
}

function extractRetrySeconds(rawMessage: string): number | undefined {
  const patterns = [
    /please retry in (\d+\.?\d*)s/i,
    /retry in (\d+\.?\d*)s/i,
    /retryDelay["']?\s*[:=]\s*["']?(\d+\.?\d*)s/i,
    /retry after (\d+\.?\d*) seconds?/i,
  ];
  for (const pattern of patterns) {
    const match = rawMessage.match(pattern);
    if (match?.[1]) {
      return Math.ceil(Number(match[1]));
    }
  }
  return undefined;
}

function cleanAIErrorMessage(rawMessage: string): string {
  let cleanMessage = rawMessage
    .replace(/^\[.*?\]\s*:?\s*/i, '')
    .replace(/\[\d{3}\s+.*?\]\s*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s*\[?\{.*$/s, '')
    .replace(/For more information.*$/i, '')
    .replace(/To monitor your current usage.*$/i, '')
    .trim();

  if (cleanMessage.length > 200) {
    cleanMessage = cleanMessage.slice(0, 197) + '...';
  }
  return cleanMessage;
}
