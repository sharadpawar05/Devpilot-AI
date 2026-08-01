export type FormFieldType = 'text' | 'code' | 'textarea' | 'select' | 'number';

export interface FormFieldConfig {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  languageField?: string;
  min?: number;
  max?: number;
  validationMessage?: string;
}

export interface TemplateFormConfig {
  templateId: string;
  fields: FormFieldConfig[];
  defaults: Record<string, string | number>;
}

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'shell', label: 'Shell' },
];

export const TEMPLATE_FORMS: Record<string, TemplateFormConfig> = {
  prompt_code_review: {
    templateId: 'prompt_code_review',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste your code here...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'context',
        label: 'Additional Context',
        type: 'textarea',
        required: false,
        placeholder: 'Any background information about this code (optional)',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_debug_code: {
    templateId: 'prompt_debug_code',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'error',
        label: 'Error / Problem',
        type: 'textarea',
        required: true,
        placeholder: 'Paste the error message or describe the problem',
        validationMessage: 'Please describe the error or problem.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste the code that has the issue...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'steps_to_reproduce',
        label: 'Steps to Reproduce',
        type: 'textarea',
        required: false,
        placeholder: '1. Run command X\n2. Click button Y\n3. Observe error',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'text',
        required: false,
        placeholder: 'e.g., Node 20, Chrome 120, macOS 14',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_explain_code: {
    templateId: 'prompt_explain_code',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste the code you want explained...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'audience',
        label: 'Audience Level',
        type: 'select',
        required: false,
        options: [
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
          { value: 'expert', label: 'Expert' },
        ],
      },
      {
        name: 'focus_areas',
        label: 'Focus Areas',
        type: 'text',
        required: false,
        placeholder: 'e.g., performance, security, design patterns',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_generate_tests: {
    templateId: 'prompt_generate_tests',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code to Test',
        type: 'code',
        required: true,
        placeholder: 'Paste the code you want to generate tests for...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'framework',
        label: 'Testing Framework',
        type: 'text',
        required: true,
        placeholder: 'e.g., Jest, Vitest, pytest, Go testing',
        validationMessage: 'Please specify a testing framework.',
      },
      {
        name: 'test_type',
        label: 'Test Type',
        type: 'select',
        required: false,
        options: [
          { value: 'unit', label: 'Unit Tests' },
          { value: 'integration', label: 'Integration Tests' },
          { value: 'e2e', label: 'End-to-End Tests' },
          { value: 'all', label: 'All Types' },
        ],
      },
      {
        name: 'additional_context',
        label: 'Additional Context',
        type: 'textarea',
        required: false,
        placeholder: 'Any specific scenarios or edge cases to cover (optional)',
      },
    ],
    defaults: { language: 'typescript', test_type: 'unit' },
  },

  prompt_readme_generator: {
    templateId: 'prompt_readme_generator',
    fields: [
      {
        name: 'project_name',
        label: 'Project Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., my-awesome-project',
        validationMessage: 'Please enter a project name.',
      },
      {
        name: 'language',
        label: 'Language / Stack',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code (optional)',
        type: 'code',
        required: false,
        placeholder: 'Paste sample code or entry point (optional)',
        languageField: 'language',
      },
      {
        name: 'description',
        label: 'Project Description',
        type: 'textarea',
        required: true,
        placeholder: 'What does this project do? What problem does it solve?',
        validationMessage: 'Please describe your project.',
      },
      {
        name: 'features',
        label: 'Key Features',
        type: 'textarea',
        required: false,
        placeholder: 'Feature 1\nFeature 2\nFeature 3',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_security_review: {
    templateId: 'prompt_security_review',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste the code to review for security issues...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'context',
        label: 'Application Context',
        type: 'textarea',
        required: false,
        placeholder: 'Is this an API endpoint, auth flow, data processing pipeline?',
      },
      {
        name: 'threat_model',
        label: 'Known Threats',
        type: 'textarea',
        required: false,
        placeholder: 'Any known threat model or security requirements (optional)',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_performance_review: {
    templateId: 'prompt_performance_review',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste the code to analyze for performance...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'context',
        label: 'Context',
        type: 'textarea',
        required: false,
        placeholder: 'What does this code do in your application?',
      },
      {
        name: 'scale',
        label: 'Expected Scale',
        type: 'text',
        required: false,
        placeholder: 'e.g., 10K requests/sec, 1M rows, 100 concurrent users',
      },
      {
        name: 'metrics',
        label: 'Current Performance Metrics',
        type: 'textarea',
        required: false,
        placeholder: 'Any known performance numbers (optional)',
      },
    ],
    defaults: { language: 'typescript' },
  },

  prompt_architecture_review: {
    templateId: 'prompt_architecture_review',
    fields: [
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        required: true,
        options: LANGUAGES,
        validationMessage: 'Please select a language.',
      },
      {
        name: 'code',
        label: 'Code',
        type: 'code',
        required: true,
        placeholder: 'Paste the codebase or key files to review...',
        languageField: 'language',
        validationMessage: 'Please paste your code.',
      },
      {
        name: 'project_type',
        label: 'Project Type',
        type: 'select',
        required: false,
        options: [
          { value: 'web-app', label: 'Web Application' },
          { value: 'api', label: 'REST/GraphQL API' },
          { value: 'cli', label: 'CLI Tool' },
          { value: 'library', label: 'Library / Package' },
          { value: 'microservice', label: 'Microservice' },
          { value: 'monolith', label: 'Monolith' },
          { value: 'data-pipeline', label: 'Data Pipeline' },
          { value: 'mobile', label: 'Mobile App' },
        ],
      },
      {
        name: 'constraints',
        label: 'Known Constraints',
        type: 'textarea',
        required: false,
        placeholder: 'e.g., Must support 100K RPM, cannot use external services',
      },
      {
        name: 'goals',
        label: 'Architecture Goals',
        type: 'textarea',
        required: false,
        placeholder: 'e.g., Improve scalability, reduce coupling, add observability',
      },
    ],
    defaults: { language: 'typescript' },
  },
};

export function getFormConfig(templateId: string): TemplateFormConfig | null {
  return TEMPLATE_FORMS[templateId] ?? null;
}

export function getLanguageFromValues(values: Record<string, string>): string {
  const lang = values['language'];
  return lang && LANGUAGES.some((l) => l.value === lang) ? lang : 'plaintext';
}
