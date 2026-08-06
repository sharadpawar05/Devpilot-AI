import type { HealthActionType } from './types';

export interface GenerationExplanation {
  whatItAdds: string[];
  estimatedExecutionTime: string;
  compatibility: string[];
}

export interface GenerationResult {
  fileName: string;
  filePath: string;
  content: string;
  language: string;
  explanation: GenerationExplanation;
}

export interface GenerationError {
  code: string;
  message: string;
}

export type GenerationState = 'idle' | 'analyzing' | 'generating' | 'ready' | 'error';

export const GENERATOR_LABELS: Record<HealthActionType, string> = {
  none: '',
  'generate-readme': 'Generate README',
  'generate-license': 'Generate LICENSE',
  'generate-gitignore': 'Generate .gitignore',
  'generate-package-json': 'Generate package.json',
  'generate-ci': 'Generate CI Workflow',
  'generate-tests': 'Generate Test Setup',
  'generate-docs': 'Generate Documentation',
  'generate-dockerfile': 'Generate Dockerfile',
  'generate-env-example': 'Generate .env.example',
  'improve-coverage': 'Improve Test Coverage',
  'improve-readme': 'Improve README',
  'add-ci-pipeline': 'Add CI Pipeline',
  'fix-vulnerabilities': 'Fix Vulnerabilities',
  'update-dependencies': 'Update Dependencies',
};

export const GENERATOR_FILE_ICONS: Record<string, string> = {
  'generate-readme': '📖',
  'generate-license': '⚖️',
  'generate-gitignore': '🚫',
  'generate-package-json': '📦',
  'generate-ci': '⚙️',
  'generate-tests': '🧪',
  'generate-docs': '📚',
  'generate-dockerfile': '🐳',
  'generate-env-example': '🔐',
  'improve-coverage': '📊',
  'improve-readme': '📝',
  'add-ci-pipeline': '🔄',
  'fix-vulnerabilities': '🔒',
  'update-dependencies': '📦',
};
