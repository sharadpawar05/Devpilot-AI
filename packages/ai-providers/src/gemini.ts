import { GoogleGenerativeAI } from '@google/generative-ai';
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

const GEMINI_COST_TABLE: Record<string, { input: number; output: number }> = {
  'gemini-3.6-flash': { input: 0.000075, output: 0.0003 },
};

const GEMINI_MODELS: AIModel[] = ['gemini-3.6-flash'];

function mapGeminiErrorCode(message: string): AIError['code'] {
  const lower = message.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('permission')) {
    return 'AUTHENTICATION_ERROR';
  }
  if (lower.includes('not found') || lower.includes('model')) {
    return 'MODEL_NOT_FOUND';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'NETWORK_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

function mapGeminiStatus(message: string): number | undefined {
  const match = message.match(/\[(\d{3})\s/);
  return match ? Number(match[1]) : undefined;
}

export class GeminiProvider implements AIProvider {
  readonly name: AIProviderName = 'gemini';

  private client: GoogleGenerativeAI | null = null;
  private config: AIProviderConfig | null = null;
  private available = false;

  initialize(config: AIProviderConfig): void {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.available = true;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.client || !this.config) {
      throw new Error('GeminiProvider not initialized. Call initialize() first.');
    }

    const model = request.model ?? this.config.defaultModel;
    const startTime = Date.now();

    const genModel = this.client.getGenerativeModel({
      model,
      systemInstruction: request.systemPrompt,
    });

    const generationConfig: Record<string, unknown> = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }
    if (request.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const timeout = request.timeout ?? this.config.timeout ?? 60000;
    const timeoutHandle = this.createTimeoutPromise<never>(timeout, model);
    const abortPromise = this.createAbortPromise<never>(request.signal);

    try {
      const result = await Promise.race([
        genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig,
        }),
        timeoutHandle.promise,
        ...(abortPromise ? [abortPromise] : []),
      ]);

      const response = result.response;
      const text = response.text();
      const usageMetadata = response.usageMetadata;
      const latencyMs = Date.now() - startTime;

      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

      const costInfo = GEMINI_COST_TABLE[model] ?? GEMINI_COST_TABLE['gemini-3.6-flash'];
      const inputCost = (inputTokens / 1000) * costInfo.input;
      const outputCost = (outputTokens / 1000) * costInfo.output;

      return {
        content: text,
        model,
        provider: 'gemini',
        tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
        cost: {
          inputCost,
          outputCost,
          totalCost: inputCost + outputCost,
          currency: 'USD',
        },
        latencyMs,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw {
        code: mapGeminiErrorCode(message),
        message,
        provider: 'gemini' as AIProviderName,
        statusCode: mapGeminiStatus(message),
        retryable: mapGeminiErrorCode(message) === 'RATE_LIMIT_EXCEEDED',
      };
    } finally {
      timeoutHandle.cancel();
    }
  }

  async *generateStream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    if (!this.client || !this.config) {
      throw new Error('GeminiProvider not initialized. Call initialize() first.');
    }

    const model = request.model ?? this.config.defaultModel;
    const startTime = Date.now();

    const genModel = this.client.getGenerativeModel({
      model,
      systemInstruction: request.systemPrompt,
    });

    const generationConfig: Record<string, unknown> = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    const timeout = request.timeout ?? this.config.timeout ?? 60000;
    const timeoutHandle = this.createTimeoutPromise<never>(timeout, model);
    const abortPromise = this.createAbortPromise<never>(request.signal);

    let result;
    try {
      result = await Promise.race([
        genModel.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig,
        }),
        timeoutHandle.promise,
        ...(abortPromise ? [abortPromise] : []),
      ]);
    } finally {
      timeoutHandle.cancel();
    }

    const stream = result.stream;
    let totalText = '';

    for await (const chunk of stream) {
      if (request.signal?.aborted) {
        break;
      }
      const text = chunk.text();
      if (text) {
        totalText += text;
        yield { type: 'token', content: text };
      }
    }

    const latencyMs = Date.now() - startTime;

    yield {
      type: 'metadata',
      provider: 'gemini',
      model,
      tokens: { input: 0, output: totalText.length, total: totalText.length },
      latencyMs,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      provider: 'gemini',
      models: GEMINI_MODELS,
      supportsStreaming: true,
      supportsJsonMode: true,
      maxContextLength: 1048576,
      costPer1kInputTokens: 0.000075,
      costPer1kOutputTokens: 0.0003,
    };
  }

  isAvailable(): boolean {
    return this.available && this.client !== null;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.generate({
        prompt: 'Say "ok"',
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch {
      return false;
    }
  }

  private createTimeoutPromise<T>(
    ms: number,
    model: string,
  ): { promise: Promise<T>; cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject({
          code: 'TIMEOUT',
          message: `Gemini request timed out after ${ms}ms (model: ${model})`,
          provider: 'gemini' as AIProviderName,
          retryable: true,
        });
      }, ms);
    });
    return { promise, cancel: () => clearTimeout(timer) };
  }

  private createAbortPromise<T>(signal: AbortSignal | undefined): Promise<T> | null {
    if (!signal) return null;
    return new Promise<T>((_, reject) => {
      const abort = () => {
        reject({
          code: 'ABORTED',
          message: 'Gemini request aborted by client disconnect',
          provider: 'gemini' as AIProviderName,
          retryable: false,
        });
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
