import { useState } from 'react';
import { Copy, Check, Download, Zap, Clock, Hash } from 'lucide-react';
import type { ChatResponse } from '@/hooks/use-chat';

interface ResponseDisplayProps {
  response: ChatResponse;
}

function renderMarkdown(text: string): string {
  let html = text;

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="relative my-3 rounded-md border border-input bg-muted/50"><div class="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-input">${lang || 'code'}</div><pre class="overflow-x-auto p-4 font-mono text-sm"><code>${escaped}</code></pre></div>`;
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

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-input" />');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ul class="my-2 space-y-1">${match}</ul>`,
  );

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, '<p class="mb-2">$1</p>');

  return html;
}

export function ResponseDisplay({ response }: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const metadata = [
      `Provider: ${response.provider}`,
      `Model: ${response.model}`,
      `Latency: ${response.latencyMs}ms`,
      `Tokens: ${response.usage.input} in / ${response.usage.output} out / ${response.usage.total} total`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      '---',
      '',
    ].join('\n');
    navigator.clipboard.writeText(metadata + response.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([response.response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Metrics bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {response.provider} / {response.model}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {response.latencyMs}ms
        </span>
        <span className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {response.usage.input.toLocaleString()} in / {response.usage.output.toLocaleString()} out
        </span>
      </div>

      {/* Response content */}
      <div className="rounded-md border border-input bg-muted/20">
        <div className="flex items-center justify-between border-b border-input px-4 py-2">
          <span className="text-sm font-medium">Response</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              .md
            </button>
          </div>
        </div>
        <div
          className="prose prose-sm dark:prose-invert max-w-none p-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(response.response) }}
        />
      </div>

      {/* Token usage */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-input p-2.5 text-center">
          <p className="text-xs text-muted-foreground">Input</p>
          <p className="text-sm font-semibold">{response.usage.input.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-input p-2.5 text-center">
          <p className="text-xs text-muted-foreground">Output</p>
          <p className="text-sm font-semibold">{response.usage.output.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-input p-2.5 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-sm font-semibold">{response.usage.total.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
