import type { PromptTemplate, PromptCategory, PromptVariable, PromptMetadata } from './types';

export interface LoadedPrompt {
  template: PromptTemplate;
  metadata: PromptMetadata;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid prompt file: missing YAML frontmatter (--- delimiters)');
  }

  const yamlBlock = match[1];
  const body = match[2].trim();

  const frontmatter: Record<string, unknown> = {};
  let currentKey = '';
  let currentValue = '';
  let inMultiline = false;

  for (const line of yamlBlock.split('\n')) {
    if (inMultiline) {
      if (line.startsWith('  ')) {
        currentValue += (currentValue ? '\n' : '') + line.trimStart();
        continue;
      }
      frontmatter[currentKey] = currentValue;
      inMultiline = false;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (!key) continue;

    currentKey = key;

    if (value === '|' || value === '>') {
      currentValue = '';
      inMultiline = true;
      continue;
    }

    if (value === '' || value === '[]' || value === '{}') {
      currentValue = value;
      inMultiline = false;
      frontmatter[key] = parseYamlValue(key, value);
      continue;
    }

    frontmatter[key] = parseYamlValue(key, value);
  }

  if (inMultiline && currentKey) {
    frontmatter[currentKey] = currentValue;
  }

  return { frontmatter, body };
}

function parseYamlValue(key: string, value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  if (key === 'tags') {
    return value.split(',').map((s) => s.trim());
  }

  return value;
}

function extractVariablesFromBody(body: string): PromptVariable[] {
  const seen = new Set<string>();
  const variables: PromptVariable[] = [];

  const simpleRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = simpleRegex.exec(body)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      variables.push({
        name,
        description: `Value for {{${name}}}`,
        required: false,
        type: 'string',
      });
    }
  }

  const ifRegex = /\{\{#if (\w+)\}\}/g;
  while ((match = ifRegex.exec(body)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      variables.push({
        name,
        description: `Value for {{${name}}}`,
        required: false,
        type: 'string',
      });
    }
  }

  return variables;
}

export function parseMarkdownPrompt(content: string): LoadedPrompt {
  const { frontmatter, body } = parseFrontmatter(content);

  const id = frontmatter.id as string;
  const name = (frontmatter.name as string) || id;
  const category = (frontmatter.category as PromptCategory) || 'general';
  const description = (frontmatter.description as string) || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const version = (frontmatter.version as number) || 1;
  const author = (frontmatter.author as string) || 'unknown';
  const temperature = (frontmatter.temperature as number) ?? 0.3;
  const maxTokens = (frontmatter.maxTokens as number) ?? 4096;
  const systemPrompt = (frontmatter.systemPrompt as string) || '';
  const createdAt = (frontmatter.createdAt as string) || new Date().toISOString();
  const updatedAt = (frontmatter.updatedAt as string) || new Date().toISOString();

  const declaredVariables = Array.isArray(frontmatter.variables)
    ? (frontmatter.variables as PromptVariable[])
    : [];

  const bodyVariables = extractVariablesFromBody(body);

  const variableMap = new Map<string, PromptVariable>();
  for (const v of bodyVariables) {
    variableMap.set(v.name, v);
  }
  for (const v of declaredVariables) {
    variableMap.set(v.name, v);
  }

  const variables = Array.from(variableMap.values());

  const template: PromptTemplate = {
    id,
    name,
    category,
    systemPrompt,
    userPromptTemplate: body,
    variables,
    temperature,
    maxTokens,
    version,
  };

  const metadata: PromptMetadata = {
    id,
    name,
    category,
    description,
    tags,
    version,
    author,
    createdAt,
    updatedAt,
  };

  return { template, metadata };
}

export function parseMarkdownPrompts(contents: string[]): LoadedPrompt[] {
  return contents.map(parseMarkdownPrompt);
}
