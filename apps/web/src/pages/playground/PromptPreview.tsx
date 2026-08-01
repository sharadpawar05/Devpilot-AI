import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface PromptPreviewProps {
  systemPrompt: string;
  userPrompt: string;
}

export function PromptPreview({ systemPrompt, userPrompt }: PromptPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullPrompt = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;

  function handleCopy() {
    navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md border border-input">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Prompt Preview
        </span>
        <span className="text-xs text-muted-foreground">Debug</span>
      </button>

      {isOpen && (
        <div className="border-t border-input">
          <div className="flex items-center justify-end px-4 py-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-4 pb-4 font-mono text-xs text-muted-foreground">
            {fullPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
