import { AIService } from '@devpilot/ai-core';
import { config } from '@devpilot/config';
import { getDefaultModel } from '@devpilot/config';

const aiService = new AIService({
  defaultProvider: 'gemini',
  globalTimeout: 60000,
  globalRetryMaxAttempts: 3,
  enableRequestLogging: true,
});

if (config.ai.geminiApiKey) {
  aiService.registerProvider('gemini', {
    apiKey: config.ai.geminiApiKey,
    defaultModel: getDefaultModel('gemini') as any,
    timeout: 60000,
  });
}

if (config.ai.openaiApiKey) {
  aiService.registerProvider('openai', {
    apiKey: config.ai.openaiApiKey,
    defaultModel: getDefaultModel('openai') as any,
    timeout: 60000,
  });
}

if (config.ai.anthropicApiKey) {
  aiService.registerProvider('anthropic', {
    apiKey: config.ai.anthropicApiKey,
    defaultModel: getDefaultModel('anthropic') as any,
    timeout: 60000,
  });
}

if (config.ai.openrouterApiKey) {
  aiService.registerProvider('openrouter', {
    apiKey: config.ai.openrouterApiKey,
    defaultModel: getDefaultModel('openrouter') as any,
    timeout: 60000,
  });
}

export { aiService };
