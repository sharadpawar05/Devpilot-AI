import type { PromptTemplate } from '../types';

export const analysisPrompts: PromptTemplate[] = [
  {
    id: 'analysis_code_quality',
    name: 'Code Quality Analysis',
    category: 'code_analysis',
    systemPrompt:
      'You are a code quality analyst. Analyze the provided code for quality issues including complexity, duplication, naming, error handling, and adherence to best practices. Provide a structured JSON response with severity ratings.',
    userPromptTemplate:
      'Analyze the following code for quality issues:\n\n```{{language}}\n{{code}}\n```\n\nContext: {{context}}',
    variables: [
      {
        name: 'language',
        description: 'Programming language of the code',
        required: true,
        type: 'string',
      },
      { name: 'code', description: 'The code to analyze', required: true, type: 'string' },
      {
        name: 'context',
        description: 'Additional context about the code',
        required: false,
        type: 'string',
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    version: 1,
  },
  {
    id: 'analysis_diff',
    name: 'Diff Analysis',
    category: 'code_analysis',
    systemPrompt:
      'You analyze code diffs to understand impact, risk, and required testing. Identify potential regressions, security concerns, and performance implications.',
    userPromptTemplate:
      'Analyze this diff for impact and risk:\n\n```diff\n{{diff}}\n```\n\nRelated files: {{related_files}}',
    variables: [
      { name: 'diff', description: 'The git diff to analyze', required: true, type: 'string' },
      {
        name: 'related_files',
        description: 'List of related files',
        required: false,
        type: 'string',
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    version: 1,
  },
  {
    id: 'analysis_error_logs',
    name: 'Error Log Analysis',
    category: 'code_analysis',
    systemPrompt:
      'You analyze error logs and stack traces to identify root causes, suggest fixes, and prioritize issues. Focus on actionable insights.',
    userPromptTemplate:
      'Analyze these error logs:\n\n{{error_logs}}\n\nEnvironment: {{environment}}',
    variables: [
      {
        name: 'error_logs',
        description: 'The error logs or stack traces',
        required: true,
        type: 'string',
      },
      {
        name: 'environment',
        description: 'Production/staging/dev environment',
        required: false,
        type: 'string',
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    version: 1,
  },
];

export function getAnalysisPrompt(id: string): PromptTemplate | undefined {
  return analysisPrompts.find((p) => p.id === id);
}
