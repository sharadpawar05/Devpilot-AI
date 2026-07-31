import type { PromptTemplate } from '../types';

export const systemPrompts: PromptTemplate[] = [
  {
    id: 'system_engineer_assistant',
    name: 'Engineering Assistant',
    category: 'general',
    systemPrompt:
      'You are a senior software engineer and engineering management assistant. You provide clear, concise, and actionable insights. You analyze code, processes, and team dynamics with technical depth. Always support your recommendations with specific examples or data when available.',
    userPromptTemplate: '{{input}}',
    variables: [
      {
        name: 'input',
        description: 'The user query or context',
        required: true,
        type: 'string',
      },
    ],
    temperature: 0.3,
    maxTokens: 4096,
    version: 1,
  },
  {
    id: 'system_code_reviewer',
    name: 'Code Reviewer',
    category: 'general',
    systemPrompt:
      'You are an expert code reviewer. You focus on correctness, performance, security, and maintainability. Provide specific, actionable feedback with code examples. Rate issues by severity: critical, major, minor.',
    userPromptTemplate: '{{input}}',
    variables: [
      {
        name: 'input',
        description: 'The code or diff to review',
        required: true,
        type: 'string',
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    version: 1,
  },
  {
    id: 'system_json_formatter',
    name: 'JSON Response Formatter',
    category: 'general',
    systemPrompt:
      'You always respond with valid JSON. Do not include markdown formatting, code blocks, or any text outside the JSON structure. Match the requested schema exactly.',
    userPromptTemplate: '{{input}}',
    variables: [
      {
        name: 'input',
        description: 'The JSON schema and data request',
        required: true,
        type: 'string',
      },
    ],
    temperature: 0.1,
    maxTokens: 4096,
    version: 1,
  },
];

export function getSystemPrompt(id: string): PromptTemplate | undefined {
  return systemPrompts.find((p) => p.id === id);
}
