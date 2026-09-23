import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('renders code blocks with line numbers and a copy button', () => {
    const html = renderMarkdown(['```ts', 'const a = 1;', 'const b = 2;', '```'].join('\n'));
    expect(html).toContain('data-copy-target');
    expect(html).toContain('code-line-numbers');
    expect(html).toContain('>1</span>');
    expect(html).toContain('>2</span>');
    expect(html).toContain('const a = 1;');
    expect(html).not.toContain('DPBLOCK');
  });

  it('converts backtick file paths into cite buttons', () => {
    const html = renderMarkdown('See `src/app.ts` for details.');
    expect(html).toContain('data-cite="src/app.ts"');
    expect(html).toContain('cite-btn');
    expect(html).not.toContain('DPBLOCK');
  });

  it('converts local markdown links into cite buttons', () => {
    const html = renderMarkdown('See [login](src/auth/login.ts#L10).');
    expect(html).toContain('data-cite="src/auth/login.ts"');
    expect(html).toContain('data-cite-line="10"');
    expect(html).not.toContain('DPBLOCK');
  });

  it('keeps http links as anchors, not cites', () => {
    const html = renderMarkdown('[docs](https://example.com/docs)');
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).not.toContain('data-cite=');
  });

  it('does not double-wrap protected blocks in paragraphs', () => {
    const html = renderMarkdown(['Intro text', '', '```js', 'x', '```'].join('\n'));
    expect(html).not.toMatch(/<p[^>]*>\s*<div class="code-block"/);
    expect(html).toContain('<div class="code-block');
  });
});
