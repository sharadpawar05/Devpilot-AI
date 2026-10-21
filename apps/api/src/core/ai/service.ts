import { AIService } from '@devpilot/ai-core';
import { config } from '@devpilot/config';
import type { AIModel, AIProviderName, AIStreamChunk } from '@devpilot/ai-providers';
import {
  withAiConcurrency,
  getStreamIdleTimeoutMs,
  AIOverloadedError,
  aiSemaphore,
} from './concurrency';
import {
  aiRequestsTotal,
  aiRequestDurationSeconds,
  aiTokensTotal,
  aiEstimatedCostUsdTotal,
  aiRequestsInFlight,
} from '@/core/metrics';

const aiService = new AIService({
  defaultProvider: 'gemini',
  globalTimeout: 60000,
  globalRetryMaxAttempts: 3,
  enableRequestLogging: true,
});

if (config.ai.geminiApiKey) {
  aiService.registerProvider('gemini', {
    apiKey: config.ai.geminiApiKey,
    defaultModel: config.ai.defaultModel as AIModel,
    timeout: 60000,
  });
}

if (config.ai.openaiApiKey) {
  aiService.registerProvider('openai', {
    apiKey: config.ai.openaiApiKey,
    defaultModel: 'gpt-4o',
    timeout: 60000,
  });
}

if (config.ai.anthropicApiKey) {
  aiService.registerProvider('anthropic', {
    apiKey: config.ai.anthropicApiKey,
    defaultModel: 'claude-3.5-sonnet',
    timeout: 60000,
  });
}

if (config.ai.openrouterApiKey) {
  aiService.registerProvider('openrouter', {
    apiKey: config.ai.openrouterApiKey,
    defaultModel: 'gpt-4',
    timeout: 60000,
  });
}

if (config.ai.groqApiKey) {
  aiService.registerProvider('groq', {
    apiKey: config.ai.groqApiKey,
    defaultModel: 'qwen/qwen3.8-27b',
    timeout: 60000,
  });
}

// Ordered provider fallback chain used when the primary provider fails with
// a non-retryable error. The gateway skips providers that are not registered.
const FALLBACK_ORDER: AIProviderName[] = ['gemini', 'groq', 'openai', 'anthropic', 'openrouter'];

const baseGenerateStream = aiService.generateStream.bind(aiService);

function recordAiCall(
  provider: AIProviderName,
  outcome: 'success' | 'error',
  startedAt: number,
  tokens?: { input: number; output: number },
  costUsd?: number,
): void {
  aiRequestsTotal.inc({ provider, outcome });
  aiRequestDurationSeconds.observe({ provider }, (Date.now() - startedAt) / 1000);
  if (tokens && (tokens.input > 0 || tokens.output > 0)) {
    aiTokensTotal.inc({ provider }, tokens.input + tokens.output);
  }
  if (typeof costUsd === 'number' && costUsd > 0) {
    aiEstimatedCostUsdTotal.inc({ provider }, costUsd);
  }
}

/**
 * Wire automatic fallback into every non-streaming generate() call so a
 * single provider outage no longer fails the whole feature.
 *
 * The whole chain runs behind the AI concurrency gate (bounded simultaneous
 * provider calls + bounded wait queue), and every terminal provider outcome
 * is recorded as metrics: latency, success/failure, tokens and estimated
 * provider cost. Gate rejections (`AIOverloadedError`) are not counted as
 * provider calls — no upstream request was made.
 */
aiService.generate = async (prompt: string, systemPrompt?: string, options = {}) => {
  const primary = options.provider ?? 'gemini';
  const fallbacks = FALLBACK_ORDER.filter((p) => p !== primary);
  const startedAt = Date.now();
  try {
    const response = await withAiConcurrency(() =>
      aiService.generateWithFallback(prompt, systemPrompt, fallbacks, options),
    );
    recordAiCall(
      response.provider,
      'success',
      startedAt,
      response.tokens,
      response.cost?.currency === 'USD' ? response.cost.totalCost : undefined,
    );
    return response;
  } catch (error) {
    if (!(error instanceof AIOverloadedError)) {
      // The failed provider in the fallback chain is not surfaced by the
      // gateway; attribute the failure to the requested primary so it is
      // still counted exactly once.
      recordAiCall(primary, 'error', startedAt);
    }
    throw error;
  }
};

class AIStreamIdleTimeoutError extends Error {
  constructor() {
    super('AI stream idle deadline exceeded');
    this.name = 'AIStreamIdleTimeoutError';
  }
}

async function nextWithIdleDeadline<T>(iterator: AsyncIterator<T>): Promise<IteratorResult<T>> {
  const idleMs = getStreamIdleTimeoutMs();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new AIStreamIdleTimeoutError()), idleMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Streams share the same concurrency gate for their whole lifetime (slot
 * released when the consumer finishes or breaks out) and are bounded by an
 * idle deadline: if the provider stops sending chunks for
 * `AI_STREAM_IDLE_TIMEOUT_MS` (default 60s), the underlying iterator is
 * closed (best-effort cancellation) and a structured error chunk is emitted
 * instead of hanging forever.
 */
aiService.generateStream = async function* (
  prompt: string,
  systemPrompt?: string,
  options = {},
): AsyncIterable<AIStreamChunk> {
  const requestedProvider: AIProviderName = options.provider ?? 'gemini';

  await aiSemaphore.acquire();
  aiRequestsInFlight.inc();
  const startedAt = Date.now();
  let slotReleased = false;
  const releaseSlot = () => {
    if (slotReleased) return;
    slotReleased = true;
    aiRequestsInFlight.dec();
    aiSemaphore.release();
  };

  let provider: AIProviderName = requestedProvider;
  let outcome: 'success' | 'error' = 'success';
  let tokens: { input: number; output: number } | undefined;

  try {
    const iterator = baseGenerateStream(prompt, systemPrompt, options)[Symbol.asyncIterator]();
    try {
      while (true) {
        const chunk = await nextWithIdleDeadline(iterator);
        if (chunk.done) break;
        const value = chunk.value;
        if (value.type === 'error') {
          outcome = 'error';
        } else if (value.type === 'metadata') {
          if (value.provider) provider = value.provider;
          if (value.tokens) tokens = { input: value.tokens.input, output: value.tokens.output };
        }
        yield value;
      }
    } finally {
      // Closing the underlying iterator propagates cancellation best-effort.
      await iterator.return?.(undefined);
    }
  } catch (error) {
    if (error instanceof AIOverloadedError) throw error;
    if (error instanceof AIStreamIdleTimeoutError) {
      outcome = 'error';
      yield {
        type: 'error',
        provider,
        error: {
          code: 'TIMEOUT',
          message: 'The AI provider stopped responding. Please try again.',
          provider,
          retryable: true,
        },
      };
    } else {
      outcome = 'error';
      throw error;
    }
  } finally {
    recordAiCall(provider, outcome, startedAt, tokens);
    releaseSlot();
  }
};

export { aiService };
