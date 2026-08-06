import { describe, it, expect } from 'vitest';

describe('Repository Chat Prompt', () => {
  const systemPrompt = `You are a helpful code assistant chatbot, similar to GitHub Copilot Chat or ChatGPT.

Core rules:
- Answer the user's question directly in the first sentence.
- Keep responses concise: 3-8 paragraphs for simple questions.
- Only generate detailed reports when explicitly asked (e.g., "generate a report", "full architecture review").
- Use bullet lists, numbered lists, bold text, and code blocks for clarity.
- Use headings only for complex multi-part answers.
- Reference repository files only when directly relevant. Say "in the indexing layer" instead of listing file paths.
- Never invent or hallucinate file paths. Only mention files that exist in the provided context.
- Be conversational and professional, not academic.
- Elaborate only when the user asks for more details.

Formatting:
- Use markdown: bullet lists, numbered lists, bold, inline code, fenced code blocks, tables.
- Avoid excessive horizontal rules (---).
- No unnecessary headers for simple answers.

Context:
You have access to the repository structure and relevant code files. Use them to answer questions accurately, but don't dump file listings unless asked.`;

  it('should instruct concise responses by default', () => {
    expect(systemPrompt).toContain('Keep responses concise: 3-8 paragraphs');
  });

  it('should instruct direct answers first', () => {
    expect(systemPrompt).toContain("Answer the user's question directly in the first sentence");
  });

  it('should instruct to avoid unnecessary reports', () => {
    expect(systemPrompt).toContain('Only generate detailed reports when explicitly asked');
  });

  it('should instruct conversational tone', () => {
    expect(systemPrompt).toContain('Be conversational and professional, not academic');
  });

  it('should instruct to avoid hallucinated file paths', () => {
    expect(systemPrompt).toContain('Never invent or hallucinate file paths');
  });

  it('should instruct to reference files only when relevant', () => {
    expect(systemPrompt).toContain('Reference repository files only when directly relevant');
  });
});

describe('Adaptive Response Length', () => {
  function getMaxTokens(question: string): number {
    const questionLower = question.toLowerCase();
    const isReportRequest =
      questionLower.includes('generate') &&
      (questionLower.includes('report') ||
        questionLower.includes('review') ||
        questionLower.includes('analysis'));
    const isDetailedRequest =
      questionLower.includes('detailed') ||
      questionLower.includes('comprehensive') ||
      questionLower.includes('full') ||
      questionLower.includes('complete') ||
      questionLower.includes('in-depth');

    return isReportRequest || isDetailedRequest ? 4096 : 1500;
  }

  it('should use 1500 tokens for simple questions', () => {
    expect(getMaxTokens('How can performance be improved?')).toBe(1500);
  });

  it('should use 1500 tokens for short questions', () => {
    expect(getMaxTokens('Where is JWT validated?')).toBe(1500);
  });

  it('should use 4096 tokens for report requests', () => {
    expect(getMaxTokens('Generate a complete architecture report')).toBe(4096);
  });

  it('should use 4096 tokens for detailed requests', () => {
    expect(getMaxTokens('Give me a detailed analysis')).toBe(4096);
  });

  it('should use 4096 tokens for comprehensive requests', () => {
    expect(getMaxTokens('Provide a comprehensive review')).toBe(4096);
  });

  it('should use 4096 tokens for full requests', () => {
    expect(getMaxTokens('Full architecture review')).toBe(4096);
  });

  it('should use 4096 tokens for in-depth requests', () => {
    expect(getMaxTokens('In-depth analysis of the codebase')).toBe(4096);
  });
});
