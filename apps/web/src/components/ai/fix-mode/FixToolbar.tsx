import { useState } from 'react';
import { Copy, Check, Download, RotateCcw, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FixResult } from './types';

interface FixToolbarProps {
  result: FixResult | null;
  isGenerating: boolean;
  onRegenerate: () => void;
  className?: string;
}

export function FixToolbar({ result, isGenerating, onRegenerate, className }: FixToolbarProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleCopyAllCode() {
    if (!result?.fixes.length) return;
    const allFixed = result.fixes.map((f) => f.fixedCode).join('\n\n');
    handleCopy(allFixed, 'code');
  }

  function handleCopyAllDiffs() {
    if (!result?.fixes.length) return;
    const allDiffs = result.fixes.map((f) => f.diff).join('\n\n');
    handleCopy(allDiffs, 'diff');
  }

  function handleDownloadMarkdown() {
    if (!result) return;
    const md = `# AI Fix Report\n\n${result.summary}\n\n---\n\n${result.fixes
      .map(
        (f, i) =>
          `## Fix ${i + 1}: ${f.description}\n\n**Severity:** ${f.severity} | **Location:** ${f.location} | **Confidence:** ${Math.round(f.confidence * 100)}%\n\n${f.explanation}\n\n### Original\n\`\`\`\n${f.originalCode}\n\`\`\`\n\n### Fixed\n\`\`\`\n${f.fixedCode}\n\`\`\`\n\n### Diff\n\`\`\`diff\n${f.diff}\n\`\`\``,
      )
      .join('\n\n---\n\n')}`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fix-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyAllCode}
        disabled={!result?.fixes.length}
        className="h-8 text-xs"
      >
        {copiedField === 'code' ? (
          <Check className="mr-1.5 h-3 w-3 text-green-500" />
        ) : (
          <Copy className="mr-1.5 h-3 w-3" />
        )}
        Copy Code
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyAllDiffs}
        disabled={!result?.fixes.length}
        className="h-8 text-xs"
      >
        {copiedField === 'diff' ? (
          <Check className="mr-1.5 h-3 w-3 text-green-500" />
        ) : (
          <FileCode className="mr-1.5 h-3 w-3" />
        )}
        Copy Diff
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadMarkdown}
        disabled={!result}
        className="h-8 text-xs"
      >
        <Download className="mr-1.5 h-3 w-3" />
        Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerate}
        disabled={isGenerating}
        className="h-8 text-xs"
      >
        <RotateCcw className={`mr-1.5 h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
        Regenerate
      </Button>
    </div>
  );
}
