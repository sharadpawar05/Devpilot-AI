export const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'react', label: 'React (JSX/TSX)' },
  { value: 'nodejs', label: 'Node.js' },
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
  { value: 'shell', label: 'Shell' },
] as const;

export const REVIEW_TYPES = [
  { value: 'Standard', label: 'Standard', description: 'General code quality review' },
  { value: 'Performance', label: 'Performance', description: 'Focus on speed and efficiency' },
  { value: 'Security', label: 'Security', description: 'Identify vulnerabilities and risks' },
  {
    value: 'Maintainability',
    label: 'Maintainability',
    description: 'Code readability and modularity',
  },
  { value: 'Architecture', label: 'Architecture', description: 'Design patterns and structure' },
  {
    value: 'Interview Feedback',
    label: 'Interview Feedback',
    description: 'Detailed assessment for learning',
  },
] as const;

export const MONACO_LANG_MAP: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  react: 'typescript',
  nodejs: 'javascript',
  python: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  cpp: 'cpp',
  csharp: 'csharp',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  sql: 'sql',
  shell: 'shell',
};
