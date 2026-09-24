export interface AIErrorResponse {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
}

export function classifyAIError(error: unknown): AIErrorResponse {
  const rawMessage = error instanceof Error ? error.message : String(error);
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
      code: 'PROVIDER_NOT_IMPLEMENTED',
      message: 'This provider is not yet implemented. Please try a different one.',
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
