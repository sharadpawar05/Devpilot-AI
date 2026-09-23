import { useEffect, useRef, useMemo } from 'react';
import { renderMarkdown as renderMarkdownUtil } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCite?: (path: string, line?: string) => void;
}

function MarkdownRenderer({ content, className, onCite }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => renderMarkdownUtil(content), [content]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const cleanupFns: Array<() => void> = [];

    // Copy buttons on code blocks
    root.querySelectorAll('[data-copy-target]').forEach((btn) => {
      const handler = async (e: Event) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-copy-target');
        if (!targetId) return;

        const codeElement = document.getElementById(targetId);
        if (!codeElement) return;

        const code = codeElement.textContent || '';
        await navigator.clipboard.writeText(code);

        const copyIcon = btn.querySelector('.copy-icon');
        const checkIcon = btn.querySelector('.check-icon');
        const label = btn.querySelector('.copy-label');

        if (copyIcon) copyIcon.classList.add('hidden');
        if (checkIcon) checkIcon.classList.remove('hidden');
        if (label) label.textContent = 'Copied!';

        setTimeout(() => {
          if (copyIcon) copyIcon.classList.remove('hidden');
          if (checkIcon) checkIcon.classList.add('hidden');
          if (label) label.textContent = 'Copy';
        }, 2000);
      };

      btn.addEventListener('click', handler);
      cleanupFns.push(() => btn.removeEventListener('click', handler));
    });

    // Inline cite buttons → open file in explorer/preview
    if (onCite) {
      root.querySelectorAll('[data-cite]').forEach((btn) => {
        const handler = (e: Event) => {
          e.preventDefault();
          const path = btn.getAttribute('data-cite');
          if (!path) return;
          const line = btn.getAttribute('data-cite-line') || undefined;
          onCite(path, line);
          btn.classList.add('cite-btn-active');
          setTimeout(() => btn.classList.remove('cite-btn-active'), 400);
        };
        btn.addEventListener('click', handler);
        cleanupFns.push(() => btn.removeEventListener('click', handler));
      });
    }

    return () => cleanupFns.forEach((fn) => fn());
  }, [html, onCite]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export { MarkdownRenderer };
