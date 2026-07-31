import type { PromptTemplate } from '../types';

export const reusableTemplates: PromptTemplate[] = [
  {
    id: 'template_sprint_summary',
    name: 'Sprint Summary Generator',
    category: 'sprint_summary',
    systemPrompt:
      'You are an engineering management assistant that generates concise sprint summaries. Focus on completed work, blockers, and next steps. Use bullet points for clarity.',
    userPromptTemplate:
      'Generate a sprint summary for sprint "{{sprint_name}}" ({{start_date}} to {{end_date}}).\n\nCompleted items:\n{{completed_items}}\n\nIn-progress items:\n{{in_progress_items}}\n\nBlockers:\n{{blockers}}',
    variables: [
      {
        name: 'sprint_name',
        description: 'Name or number of the sprint',
        required: true,
        type: 'string',
      },
      { name: 'start_date', description: 'Sprint start date', required: true, type: 'string' },
      { name: 'end_date', description: 'Sprint end date', required: true, type: 'string' },
      {
        name: 'completed_items',
        description: 'List of completed items',
        required: true,
        type: 'string',
      },
      {
        name: 'in_progress_items',
        description: 'List of in-progress items',
        required: false,
        type: 'string',
      },
      { name: 'blockers', description: 'List of blockers', required: false, type: 'string' },
    ],
    temperature: 0.3,
    maxTokens: 2048,
    version: 1,
  },
  {
    id: 'template_pr_summary',
    name: 'PR Summary Generator',
    category: 'pr_summary',
    systemPrompt:
      'You generate concise pull request summaries. Focus on what changed, why it changed, and any impact on existing functionality. Keep it under 200 words.',
    userPromptTemplate:
      'Generate a PR summary for the following changes:\n\nTitle: {{pr_title}}\nDescription: {{pr_description}}\n\nDiff summary:\n{{diff_summary}}',
    variables: [
      { name: 'pr_title', description: 'Pull request title', required: true, type: 'string' },
      {
        name: 'pr_description',
        description: 'Pull request description',
        required: false,
        type: 'string',
      },
      {
        name: 'diff_summary',
        description: 'Summary of code changes',
        required: true,
        type: 'string',
      },
    ],
    temperature: 0.3,
    maxTokens: 1024,
    version: 1,
  },
  {
    id: 'template_release_notes',
    name: 'Release Notes Generator',
    category: 'release_notes',
    systemPrompt:
      'You generate user-facing release notes from technical changes. Translate technical jargon into clear, user-friendly language. Group changes by category: features, improvements, bug fixes.',
    userPromptTemplate:
      'Generate release notes for version {{version}} based on these changes:\n\n{{changes}}',
    variables: [
      { name: 'version', description: 'Version number', required: true, type: 'string' },
      {
        name: 'changes',
        description: 'List of changes or changelog entries',
        required: true,
        type: 'string',
      },
    ],
    temperature: 0.4,
    maxTokens: 2048,
    version: 1,
  },
];

export function getReusableTemplate(id: string): PromptTemplate | undefined {
  return reusableTemplates.find((t) => t.id === id);
}
