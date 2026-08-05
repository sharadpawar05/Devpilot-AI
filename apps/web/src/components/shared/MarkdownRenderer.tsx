import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showCopyButton?: boolean;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
  );
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div className="relative my-4 rounded-lg border border-input bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between border-b border-input bg-muted/50 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language || 'code'}</span>
        <CopyButton code={children} />
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          style={oneDark}
          language={language || 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            },
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
      {children}
    </code>
  );
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const components = useMemo(
    () => ({
      code({ className, children }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(children).replace(/\n$/, '');

        if (match || (typeof children === 'string' && children.includes('\n'))) {
          return <CodeBlock language={match?.[1] || ''}>{codeString}</CodeBlock>;
        }

        return <InlineCode>{children}</InlineCode>;
      },
      table({ children, ...props }: any) {
        return (
          <div className="my-4 overflow-x-auto rounded-lg border border-input">
            <table className="min-w-full divide-y divide-border" {...props}>
              {children}
            </table>
          </div>
        );
      },
      thead({ children, ...props }: any) {
        return (
          <thead className="bg-muted/50" {...props}>
            {children}
          </thead>
        );
      },
      th({ children, ...props }: any) {
        return (
          <th
            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
            {...props}
          >
            {children}
          </th>
        );
      },
      td({ children, ...props }: any) {
        return (
          <td className="px-4 py-3 text-sm border-t border-border" {...props}>
            {children}
          </td>
        );
      },
      blockquote({ children, ...props }: any) {
        return (
          <blockquote
            className="my-4 border-l-4 border-primary/50 bg-muted/30 pl-4 py-2 italic text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        );
      },
      h1({ children, ...props }: any) {
        return (
          <h1 className="mt-8 mb-4 text-2xl font-bold text-foreground" {...props}>
            {children}
          </h1>
        );
      },
      h2({ children, ...props }: any) {
        return (
          <h2 className="mt-6 mb-3 text-xl font-semibold text-foreground" {...props}>
            {children}
          </h2>
        );
      },
      h3({ children, ...props }: any) {
        return (
          <h3 className="mt-5 mb-2 text-lg font-semibold text-foreground" {...props}>
            {children}
          </h3>
        );
      },
      h4({ children, ...props }: any) {
        return (
          <h4 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props}>
            {children}
          </h4>
        );
      },
      p({ children, ...props }: any) {
        return (
          <p className="mb-4 text-sm leading-relaxed text-foreground" {...props}>
            {children}
          </p>
        );
      },
      ul({ children, ...props }: any) {
        return (
          <ul className="my-3 space-y-2 list-disc list-inside text-sm text-foreground" {...props}>
            {children}
          </ul>
        );
      },
      ol({ children, ...props }: any) {
        return (
          <ol
            className="my-3 space-y-2 list-decimal list-inside text-sm text-foreground"
            {...props}
          >
            {children}
          </ol>
        );
      },
      li({ children, ...props }: any) {
        return (
          <li className="ml-4" {...props}>
            {children}
          </li>
        );
      },
      a({ href, children, ...props }: any) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      },
      strong({ children, ...props }: any) {
        return (
          <strong className="font-semibold text-foreground" {...props}>
            {children}
          </strong>
        );
      },
      em({ children, ...props }: any) {
        return (
          <em className="italic text-foreground" {...props}>
            {children}
          </em>
        );
      },
      hr({ ...props }: any) {
        return <hr className="my-6 border-border" {...props} />;
      },
    }),
    [],
  );

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
