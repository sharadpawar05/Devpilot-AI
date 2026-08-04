import { useState, useCallback } from 'react';
import { Copy, Download, Maximize2, Minimize2, WrapText, Check, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPreviewProps {
  content: string;
  fileName: string;
  language: string;
  filePath: string;
  className?: string;
}

const LANGUAGE_SYNTAX_MAP: Record<string, string> = {
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  javascript: 'javascript',
  typescript: 'typescript',
  markdown: 'markdown',
  dockerfile: 'dockerfile',
  text: 'plaintext',
  toml: 'toml',
  sh: 'bash',
  bash: 'bash',
  css: 'css',
  html: 'html',
};

function getLanguageClass(lang: string): string {
  return LANGUAGE_SYNTAX_MAP[lang] || 'plaintext';
}

export function ArtifactPreview({
  content,
  fileName,
  language,
  filePath,
  className,
}: ArtifactPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create textarea
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, fileName]);

  const lines = content.split('\n');

  return (
    <div
      className={cn(
        'rounded-lg border border-input bg-card overflow-hidden',
        expanded && 'fixed inset-4 z-50',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-input bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileCode className="h-3.5 w-3.5" />
          <span className="font-mono font-medium text-foreground">{filePath}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
            {getLanguageClass(language)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            className={cn(
              'rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              wordWrap && 'bg-muted text-foreground',
            )}
            title="Toggle word wrap"
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-auto bg-background">
        <pre
          className={cn(
            'p-4 font-mono text-xs leading-relaxed',
            wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
          )}
        >
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="inline-block w-10 shrink-0 select-none border-r border-border/50 pr-3 text-right text-muted-foreground/50">
                  {i + 1}
                </span>
                <span className="flex-1 pl-4">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Line count */}
      <div className="border-t border-border/50 bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        {lines.length} lines · {content.length.toLocaleString()} characters
      </div>
    </div>
  );
}
