import { AIService } from '@devpilot/ai-core';
import { config } from '@devpilot/config';

const aiService = new AIService({
  defaultProvider: 'gemini',
  globalTimeout: 60000,
  globalRetryMaxAttempts: 3,
  enableRequestLogging: true,
});

if (config.ai.geminiApiKey) {
  aiService.registerProvider('gemini', {
    apiKey: config.ai.geminiApiKey,
    defaultModel: 'gemini-3.6-flash',
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

export { aiService };
