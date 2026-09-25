import DOMPurify from 'dompurify';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const FILE_PATH_IN_TEXT =
  /([\w][\w./-]*\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|cpp|c|h|hpp|swift|scala|vue|svelte|css|scss|sass|less|html|htm|json|jsonc|md|mdx|yml|yaml|toml|ini|env|sh|bash|zsh|sql|prisma|graphql|gql|proto|diff|lock|txt))\b(?:#L(\d+)(?:-L(\d+))?|\?line=(\d+))?/g;

function citeButton(path: string, label: string, line?: string): string {
  const title = line ? `Open ${path} line ${line}` : `Open ${path}`;
  const lineAttr = line ? ` data-cite-line="${escapeAttr(line)}"` : '';
  const shortLabel = label.length > 48 ? `…${label.slice(-47)}` : label;
  return `<button type="button" data-cite="${escapeAttr(path)}"${lineAttr} class="cite-btn" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><svg class="cite-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="cite-label">${escapeHtml(shortLabel)}</span>${line ? `<span class="cite-line">L${escapeHtml(line)}</span>` : ''}</button>`;
}

export function renderMarkdown(text: string): string {
  let html = text;

  // Stash fully-built HTML (code blocks, cite buttons) so later regex passes can't corrupt it
  const stash: string[] = [];
  const protect = (chunk: string): string => {
    stash.push(chunk);
    return `@@DPBLOCK${stash.length - 1}@@`;
  };
  const restore = (s: string): string =>
    s.replace(/@@DPBLOCK(\d+)@@/g, (_m, i: string) => stash[Number(i)] ?? '');

  // Fenced code blocks with language badge, line numbers, and copy button
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const raw = code.replace(/\n$/, '');
    const lines = raw.split('\n');
    const escaped = lines.map((line) => escapeHtml(line)).join('\n');
    const lineNumbers = lines.map((_, i) => `<span class="block">${i + 1}</span>`).join('');
    const codeId = `code-${Math.random().toString(36).slice(2, 9)}`;
    const langLabel = escapeHtml(lang || 'code');
    return protect(
      `<div class="code-block group relative my-3 overflow-hidden rounded-xl border border-input shadow-sm"><div class="code-block-header flex items-center justify-between border-b border-input bg-muted/70 px-3 py-1.5 text-xs"><span class="code-block-lang font-medium text-muted-foreground">${langLabel}</span><button type="button" data-copy-target="${codeId}" class="copy-button inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Copy code"><svg class="copy-icon h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="check-icon h-3.5 w-3.5 hidden text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span class="copy-label">Copy</span></button></div><div class="code-block-body flex overflow-x-auto"><div class="code-line-numbers shrink-0 select-none border-r border-input bg-muted/40 px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground/50" aria-hidden="true">${lineNumbers}</div><pre class="min-w-0 flex-1 p-3 font-mono text-[13px] leading-6"><code id="${codeId}">${escaped}</code></pre></div></div>`,
    );
  });

  // Inline file citations: markdown links to local file paths → cite buttons
  html = html.replace(
    /\[([^\]]+)\]\(((?!https?:\/\/|mailto:|#|tel:)[^)\s]+\.[A-Za-z0-9]+(?:#[^)]*)?)\)/g,
    (_m, label: string, href: string) => {
      const [pathPart, hash] = href.split('#');
      const lineMatch = hash?.match(/^L(\d+)/);
      return protect(citeButton(pathPart, label || pathPart, lineMatch?.[1]));
    },
  );

  // Backtick-wrapped file paths → inline cite buttons
  html = html.replace(
    /`([\w][\w./-]*\.[A-Za-z0-9]{1,10}(?:#\d+(?:-\d+)?)?)`/g,
    (_m, path: string) => {
      const [pathPart, hash] = path.split('#');
      const lineMatch = hash?.match(/^(\d+)/);
      return protect(citeButton(pathPart, pathPart, lineMatch?.[1]));
    },
  );

  // Bare file paths in text → cite buttons
  html = html.replace(
    FILE_PATH_IN_TEXT,
    (_match, path: string, l1?: string, _l2?: string, l3?: string) => {
      const line = l1 || l3;
      return protect(citeButton(path, path, line));
    },
  );

  // Inline code (non-path leftovers)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">$1</code>',
  );

  // Headers (more # first so #### is not consumed by ###)
  html = html.replace(/^##### (.+)$/gm, '<h5 class="mt-3 mb-1.5 text-sm font-semibold">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="mt-3 mb-1.5 text-base font-semibold">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 text-base font-semibold">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-5 mb-2 text-lg font-bold">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-6 mb-3 text-xl font-bold">$1</h1>');

  // Normalize * / + unordered-list markers to - (before emphasis, so lone * bullets
  // are not treated as italics; **bold** is untouched because no space follows *)
  html = html.replace(/^\* (?!\*)(.+)$/gm, '- $1');
  html = html.replace(/^\+ (.+)$/gm, '- $1');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-4 border-input" />');

  // Links: [text](url) — http(s) only (local files already became cite buttons)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
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

  // Paragraphs (must be last) — skip lines that are only protected blocks (code, cites)
  html = html.replace(/^(?!<[a-z/])(?!@@DPBLOCK\d+@@$)((?!^\s*$).+)$/gm, '<p class="mb-2">$1</p>');

  html = restore(html);

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['button', 'span'],
    ADD_ATTR: [
      'class',
      'id',
      'data-copy-target',
      'data-copy-feedback',
      'data-cite',
      'data-cite-line',
      'target',
      'rel',
      'href',
      'title',
      'type',
      'aria-label',
      'aria-hidden',
    ],
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
