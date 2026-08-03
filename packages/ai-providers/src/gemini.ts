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
} from './types';

const GEMINI_COST_TABLE: Record<string, { input: number; output: number }> = {
  'gemini-3.6-flash': { input: 0.000075, output: 0.0003 },
  'gemini-3.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-3.1-flash-lite': { input: 0.0000375, output: 0.00015 },
};

const GEMINI_MODELS: AIModel[] = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];

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

    const result = await Promise.race([
      genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig,
      }),
      this.createTimeoutPromise<never>(timeout, model),
    ]);

    const response = result.response;
    const text = response.text();
    const usageMetadata = response.usageMetadata;
    const latencyMs = Date.now() - startTime;

    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

    const costInfo = GEMINI_COST_TABLE[model] ?? GEMINI_COST_TABLE['gemini-3.5-flash'];
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

    const result = await Promise.race([
      genModel.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig,
      }),
      this.createTimeoutPromise<never>(timeout, model),
    ]);

    const stream = result.stream;
    let totalText = '';

    for await (const chunk of stream) {
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

  private createTimeoutPromise<T>(ms: number, model: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject({
          code: 'TIMEOUT',
          message: `Gemini request timed out after ${ms}ms (model: ${model})`,
          provider: 'gemini' as AIProviderName,
          retryable: true,
        });
      }, ms);
    });
  }
}
