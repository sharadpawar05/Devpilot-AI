const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  toml: 'toml',
  ini: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  prisma: 'prisma',
  proto: 'protobuf',
};

const FILENAME_LANGUAGE_MAP: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  'cmakelists.txt': 'cmake',
  '.gitignore': 'plaintext',
  '.env': 'plaintext',
  '.env.example': 'plaintext',
  'package.json': 'json',
  'tsconfig.json': 'json',
};

export function getLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  const fileName = lower.split('/').pop() ?? lower;

  if (FILENAME_LANGUAGE_MAP[fileName]) {
    return FILENAME_LANGUAGE_MAP[fileName];
  }

  const ext = fileName.includes('.') ? (fileName.split('.').pop() ?? '') : '';
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'plaintext';
}

export function getLanguageLabel(language: string): string {
  if (language === 'plaintext') return 'Plain Text';
  if (language === 'xml') return 'HTML';
  if (language === 'cpp') return 'C++';
  if (language === 'csharp') return 'C#';
  return language.charAt(0).toUpperCase() + language.slice(1);
}
