import type { PromptTemplate, CompiledPrompt } from './types';

export function compilePrompt(
  template: PromptTemplate,
  variables: Record<string, unknown>,
): CompiledPrompt {
  let userPrompt = template.userPromptTemplate;

  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
    variables,
    metadata: {
      templateId: template.id,
      templateVersion: template.version,
      compiledAt: new Date(),
    },
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
