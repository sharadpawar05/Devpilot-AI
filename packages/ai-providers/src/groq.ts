import type {
  AIProvider,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  ProviderCapabilities,
  AIProviderName,
  AIModel,
  AIError,
} from './types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const GROQ_MODELS: AIModel[] = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
const DEFAULT_GROQ_MODEL: AIModel = 'qwen/qwen3.8-27b';

const GROQ_COST_TABLE: Record<string, { input: number; output: number }> = {
  'qwen/qwen3.8-27b': { input: 0.0008, output: 0.004 },
  'openai/gpt-oss-20b': { input: 0.000075, output: 0.0003 },
};

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface GroqChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: GroqUsage;
  model?: string;
}

interface GroqStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; role?: string };
    finish_reason?: string | null;
  }>;
  usage?: GroqUsage | null;
  model?: string;
}

function mapGroqError(status: number, message: string): AIError {
  const lower = message.toLowerCase();

  if (status === 401 || lower.includes('invalid api key') || lower.includes('unauthorized')) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid Groq API key. Check GROAK_API_KEY in your .env file.',
      provider: 'groq',
      statusCode: 401,
      retryable: false,
    };
  }

  if (status === 404 || (lower.includes('model') && lower.includes('not'))) {
    return {
      code: 'MODEL_NOT_FOUND',
      message: 'The selected Groq model is not available. Try qwen/qwen3.8-27b.',
      provider: 'groq',
      statusCode: 404,
      retryable: false,
    };
  }

  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Groq rate limit exceeded. Please wait a moment and try again.',
      provider: 'groq',
      statusCode: 429,
      retryable: true,
    };
  }

  if (status >= 500) {
    return {
      code: 'STREAM_ERROR',
      message: 'Groq is temporarily unavailable. Please try again.',
      provider: 'groq',
      statusCode: status,
      retryable: true,
    };
  }

  return {
    code: 'INVALID_REQUEST',
    message: message || 'Groq request failed.',
    provider: 'groq',
    statusCode: status,
    retryable: false,
  };
}

export class GroqProvider implements AIProvider {
  readonly name: AIProviderName = 'groq';

  private config: AIProviderConfig | null = null;
  private available = false;

  initialize(config: AIProviderConfig): void {
    this.config = config;
    this.available = Boolean(config.apiKey);
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const { model, timeout } = this.resolveRequest(request);
    const startTime = Date.now();

    const response = await this.fetchWithTimeout(
      `${GROQ_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config!.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: this.buildMessages(request),
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 2048,
          ...(request.responseFormat === 'json'
            ? { response_format: { type: 'json_object' } }
            : {}),
        }),
      },
      timeout,
      request.signal,
    );

    const data = (await response.json()) as GroqChatResponse;

    if (!response.ok) {
      const message =
        (data as { error?: { message?: string } }).error?.message ||
        `Groq request failed with status ${response.status}`;
      throw mapGroqError(response.status, message);
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
    const costInfo = GROQ_COST_TABLE[model] ?? GROQ_COST_TABLE[DEFAULT_GROQ_MODEL];
    const inputCost = (inputTokens / 1000) * costInfo.input;
    const outputCost = (outputTokens / 1000) * costInfo.output;

    return {
      content,
      model: (data.model ?? model) as AIModel,
      provider: 'groq',
      tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
      cost: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        currency: 'USD',
      },
      latencyMs: Date.now() - startTime,
    };
  }

  async *generateStream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const { model, timeout } = this.resolveRequest(request);
    const startTime = Date.now();

    const response = await this.fetchWithTimeout(
      `${GROQ_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config!.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: this.buildMessages(request),
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 2048,
          stream: true,
        }),
      },
      timeout,
      request.signal,
    );

    if (!response.ok || !response.body) {
      let message = `Groq request failed with status ${response.status}`;
      try {
        const err = (await response.json()) as { error?: { message?: string } };
        if (err.error?.message) message = err.error.message;
      } catch {
        // keep default message
      }
      throw mapGroqError(response.status, message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalText = '';
    let chunkTimer: ReturnType<typeof setTimeout> | undefined;

    const withChunkDeadline = async <T>(promise: Promise<T>): Promise<T> => {
      let timedOut = false;
      const deadline = new Promise<never>((_, reject) => {
        chunkTimer = setTimeout(() => {
          timedOut = true;
          reader.cancel().catch(() => undefined);
          reject({
            code: 'TIMEOUT',
            message: `Groq stream stalled: no data received for ${timeout}ms`,
            provider: 'groq' as AIProviderName,
            retryable: true,
          });
        }, timeout);
      });
      try {
        return await Promise.race([promise, deadline]);
      } finally {
        clearTimeout(chunkTimer);
        if (timedOut) {
          // reader already cancelled
        }
      }
    };

    try {
      while (true) {
        if (request.signal?.aborted) {
          await reader.cancel().catch(() => undefined);
          throw {
            code: 'ABORTED',
            message: 'Groq stream aborted by client disconnect',
            provider: 'groq' as AIProviderName,
            retryable: false,
          } satisfies AIError;
        }

        const { done, value } = await withChunkDeadline(reader.read());
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const chunk = JSON.parse(payload) as GroqStreamChunk;
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) {
              totalText += text;
              yield { type: 'token', content: text };
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      clearTimeout(chunkTimer);
      reader.releaseLock();
    }

    yield {
      type: 'metadata',
      provider: 'groq',
      model,
      tokens: {
        input: 0,
        output: totalText.length,
        total: totalText.length,
      },
      latencyMs: Date.now() - startTime,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      provider: 'groq',
      models: GROQ_MODELS,
      supportsStreaming: true,
      supportsJsonMode: true,
      maxContextLength: 131072,
      costPer1kInputTokens: 0.0008,
      costPer1kOutputTokens: 0.004,
      rateLimitRpm: 30,
    };
  }

  isAvailable(): boolean {
    return this.available && this.config !== null;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.generate({ prompt: 'Say "ok"', maxTokens: 8, temperature: 0 });
      return true;
    } catch {
      return false;
    }
  }

  private resolveRequest(request: AIRequest): { model: AIModel; timeout: number } {
    if (!this.config) {
      throw {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'GroqProvider not initialized. Call initialize() first.',
        provider: 'groq',
        retryable: false,
      } satisfies AIError;
    }

    const model = (request.model ?? this.config.defaultModel ?? DEFAULT_GROQ_MODEL) as AIModel;
    const timeout = request.timeout ?? this.config.timeout ?? 60000;
    return { model, timeout };
  }

  private buildMessages(request: AIRequest): GroqChatMessage[] {
    const messages: GroqChatMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });
    return messages;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw {
          code: 'ABORTED',
          message: 'Groq request aborted by client disconnect',
          provider: 'groq' as AIProviderName,
          retryable: false,
        } satisfies AIError;
      }
      if (controller.signal.aborted) {
        throw {
          code: 'TIMEOUT',
          message: `Groq request timed out after ${timeoutMs}ms`,
          provider: 'groq' as AIProviderName,
          retryable: true,
        } satisfies AIError;
      }
      throw {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error contacting Groq',
        provider: 'groq' as AIProviderName,
        retryable: true,
      } satisfies AIError;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
