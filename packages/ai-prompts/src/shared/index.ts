export const sharedFragments = {
  formattingInstructions:
    'Format your response clearly. Use markdown headings (##) for sections, bullet points for lists, and **bold** for emphasis on key findings.',

  jsonOutputInstructions:
    'Respond ONLY with valid JSON. Do not include any text, markdown, or code blocks outside the JSON object. Ensure all strings are properly escaped.',

  codeBlock:
    'When referencing code, use markdown code blocks with the appropriate language identifier:\n```language\ncode here\n```',

  severityLevels:
    'Rate issues by severity:\n- **Critical**: Causes data loss, security vulnerability, or system outage\n- **Major**: Significant functional impact or performance degradation\n- **Minor**: Code quality, style, or minor functional concern\n- **Info**: Suggestion for improvement, no functional impact',

  dateContext:
    'Current date: {{current_date}}. Use this to provide time-relative context in your response.',
} as const;

export type SharedFragmentKey = keyof typeof sharedFragments;

export function getSharedFragment(key: SharedFragmentKey): string {
  return sharedFragments[key];
}
