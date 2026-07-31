import type { PromptTemplate, PromptCategory } from './types';
import { systemPrompts, getSystemPrompt } from './system/index';
import { reusableTemplates, getReusableTemplate } from './templates/index';
import { analysisPrompts, getAnalysisPrompt } from './analysis/index';
import { reportPrompts, getReportPrompt } from './reports/index';

const allDefaultTemplates: PromptTemplate[] = [
  ...systemPrompts,
  ...reusableTemplates,
  ...analysisPrompts,
  ...reportPrompts,
];

const templates: Map<string, PromptTemplate> = new Map();

function initializeDefaults(): void {
  for (const template of allDefaultTemplates) {
    templates.set(template.id, template);
  }
}

initializeDefaults();

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

export { getSystemPrompt, getReusableTemplate, getAnalysisPrompt, getReportPrompt };

export { sharedFragments, getSharedFragment } from './shared/index';
export type { SharedFragmentKey } from './shared/index';
