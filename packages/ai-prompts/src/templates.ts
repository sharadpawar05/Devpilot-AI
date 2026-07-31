import type { PromptTemplate, PromptCategory } from './types';

const templates: Map<string, PromptTemplate> = new Map();

export function registerTemplate(template: PromptTemplate): void {
  templates.set(template.id, template);
}

export function getTemplate(id: string): PromptTemplate | undefined {
  return templates.get(id);
}

export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return Array.from(templates.values()).filter((t) => t.category === category);
}

export function getAllTemplates(): PromptTemplate[] {
  return Array.from(templates.values());
}
