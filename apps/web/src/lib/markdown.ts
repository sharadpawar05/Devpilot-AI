import DOMPurify from 'dompurify';

export function renderMarkdown(text: string): string {
  let html = text;

  // Fenced code blocks with language badge and copy button
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const codeId = `code-${Math.random().toString(36).slice(2, 9)}`;
    return `<div class="relative my-3 rounded-md border border-input bg-muted/50"><div class="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-input"><span>${lang || 'code'}</span><button data-copy-target="${codeId}" data-copy-feedback="true" class="copy-button flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"><svg class="copy-icon h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="check-icon h-3 w-3 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span class="copy-label">Copy</span></button></div><pre class="overflow-x-auto p-4 font-mono text-sm"><code id="${codeId}">${escaped}</code></pre></div>`;
  });

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">$1</code>',
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 text-base font-semibold">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-5 mb-2 text-lg font-bold">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-6 mb-3 text-xl font-bold">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-4 border-input" />');

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">$1</a>',
  );

  // Blockquotes: > text
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="my-2 border-l-4 border-primary/30 pl-4 text-muted-foreground italic">$1</blockquote>',
  );

  // Task lists: - [ ] or - [x]
  html = html.replace(
    /^- \[ \] (.+)$/gm,
    '<li class="ml-4 list-disc"><span class="inline-flex items-center gap-2"><span class="inline-block h-4 w-4 rounded border border-input bg-background"></span><span>$1</span></span></li>',
  );
  html = html.replace(
    /^- \[x\] (.+)$/gm,
    '<li class="ml-4 list-disc"><span class="inline-flex items-center gap-2"><span class="inline-block h-4 w-4 rounded border border-primary bg-primary"><svg class="h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span><span>$1</span></span></li>',
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(
    /(<li[^>]*class="[^"]*list-disc[^"]*"[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ul class="my-2 space-y-1">${match}</ul>`,
  );

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  html = html.replace(
    /(<li[^>]*class="[^"]*list-decimal[^"]*"[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ol class="my-2 space-y-1 list-decimal">${match}</ol>`,
  );

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, header, _sep, body) => {
      const headerCells = header.split('|').filter((c: string) => c.trim());
      const rows = body.trim().split('\n');
      const headerHtml = headerCells
        .map(
          (cell: string) =>
            `<th class="border border-input px-3 py-2 text-left text-sm font-semibold">${cell.trim()}</th>`,
        )
        .join('');
      const bodyHtml = rows
        .map((row: string) => {
          const cells = row.split('|').filter((c: string) => c.trim());
          return `<tr>${cells.map((cell: string) => `<td class="border border-input px-3 py-2 text-sm">${cell.trim()}</td>`).join('')}</tr>`;
        })
        .join('');
      return `<div class="my-3 overflow-x-auto"><table class="min-w-full border-collapse border border-input"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    },
  );

  // Paragraphs (must be last)
  html = html.replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, '<p class="mb-2">$1</p>');

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['button'],
    ADD_ATTR: ['class', 'id', 'data-copy-target', 'data-copy-feedback', 'target', 'rel', 'href'],
  });
}

export function extractSections(text: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];
  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    const match = h1Match || h2Match || h3Match;
    if (match) {
      if (currentTitle)
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      currentTitle = match[1].replace(/\*\*/g, '').replace(/[:]+$/, '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentTitle)
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  return sections;
}

export function extractScore(text: string): number | null {
  const patterns = [/\*\*(\d+\.?\d*)\s*\/\s*10\*\*/, /(\d+\.?\d*)\s*\/\s*10/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseFloat(match[1]);
      if (score >= 0 && score <= 10) return score;
    }
  }
  return null;
}

export function getScoreColor(score: number): string {
  if (score >= 9) return 'text-green-500';
  if (score >= 7) return 'text-blue-500';
  if (score >= 5) return 'text-amber-500';
  return 'text-red-500';
}

export function getScoreLabel(score: number): string {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Needs Improvement';
  return 'Poor';
}

export function getScoreBg(score: number): string {
  if (score >= 9) return 'bg-green-500/10 border-green-500/30';
  if (score >= 7) return 'bg-blue-500/10 border-blue-500/30';
  if (score >= 5) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}
