import { AIService } from '@devpilot/ai-core';
import { config } from '@devpilot/config';
import type { AIModel, AIProviderName } from '@devpilot/ai-providers';

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

// Wire automatic fallback into every non-streaming generate() call so a
// single provider outage no longer fails the whole feature. Streaming
// (generateStream) is intentionally not wrapped — fallback mid-stream is
// not supported by the gateway.
aiService.generate = (prompt: string, systemPrompt?: string, options = {}) => {
  const primary = options.provider ?? 'gemini';
  const fallbacks = FALLBACK_ORDER.filter((p) => p !== primary);
  return aiService.generateWithFallback(prompt, systemPrompt, fallbacks, options);
};

export { aiService };
