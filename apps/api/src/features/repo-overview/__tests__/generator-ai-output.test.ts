import { describe, it, expect, vi, beforeEach } from 'vitest';

const aiGenerate = vi.fn();

vi.mock('@/core/ai/service', () => ({
  aiService: {
    generate: (...args: unknown[]) => aiGenerate(...args),
  },
}));

const getReadme = vi.fn();
const getLanguages = vi.fn();
const getFlatFilePaths = vi.fn();
const getFileContent = vi.fn();

vi.mock('@/features/repo-intelligence', () => ({
  repositoryIntelligenceService: {
    getReadme: (...args: unknown[]) => getReadme(...args),
    getLanguages: (...args: unknown[]) => getLanguages(...args),
    getFlatFilePaths: (...args: unknown[]) => getFlatFilePaths(...args),
    getFileContent: (...args: unknown[]) => getFileContent(...args),
  },
}));

import { generatorService } from '../generator-service';

describe('generatorService invalid AI output handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReadme.mockResolvedValue('');
    getLanguages.mockResolvedValue({ TypeScript: 5000 });
    getFlatFilePaths.mockResolvedValue(['src/index.ts', 'package.json']);
    getFileContent.mockResolvedValue(null);
  });

  it('throws when the AI returns empty content instead of shipping an empty artifact', async () => {
    aiGenerate.mockResolvedValue({ content: '' });

    await expect(
      generatorService.generate('user-1', 'acme', 'demo', 'generate-readme'),
    ).rejects.toThrow(/empty content/i);
  });

  it('throws when the AI returns only whitespace', async () => {
    aiGenerate.mockResolvedValue({ content: '   \n\t  \n' });

    await expect(
      generatorService.generate('user-1', 'acme', 'demo', 'generate-license'),
    ).rejects.toThrow(/empty content/i);
  });

  it('cleans fences and preamble text from valid AI output', async () => {
    aiGenerate.mockResolvedValue({
      content: 'Here is your README:\n```markdown\n# My Project\n\nDocs here.\n```',
    });

    const result = await generatorService.generate('user-1', 'acme', 'demo', 'generate-readme');

    expect(result.content).toBe('# My Project\n\nDocs here.');
    expect(result.content.trim().length).toBeGreaterThan(0);
    expect(result.fileName).toBeTruthy();
  });

  it('preserves a heading-first markdown file without fences', async () => {
    aiGenerate.mockResolvedValue({ content: '# Title\n\nBody text.\n' });

    const result = await generatorService.generate('user-1', 'acme', 'demo', 'generate-readme');

    expect(result.content).toBe('# Title\n\nBody text.');
  });

  it('rejects an unknown generator type without calling the AI', async () => {
    await expect(
      generatorService.generate('user-1', 'acme', 'demo', 'none' as never),
    ).rejects.toThrow(/Unknown generator type/);
    expect(aiGenerate).not.toHaveBeenCalled();
  });
});
