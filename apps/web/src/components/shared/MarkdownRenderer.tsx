import { useEffect, useRef, useMemo } from 'react';
import { renderMarkdown as renderMarkdownUtil } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => renderMarkdownUtil(content), [content]);

  useEffect(() => {
    if (!containerRef.current) return;

    const buttons = containerRef.current.querySelectorAll('[data-copy-target]');
    const cleanupFns: Array<() => void> = [];

    buttons.forEach((btn) => {
      const handler = async (e: Event) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-copy-target');
        if (!targetId) return;

        const codeElement = document.getElementById(targetId);
        if (!codeElement) return;

        const code = codeElement.textContent || '';
        await navigator.clipboard.writeText(code);

        // Show feedback
        const copyIcon = btn.querySelector('.copy-icon');
        const checkIcon = btn.querySelector('.check-icon');
        const label = btn.querySelector('.copy-label');

        if (copyIcon) copyIcon.classList.add('hidden');
        if (checkIcon) checkIcon.classList.remove('hidden');
        if (label) label.textContent = 'Copied!';

        // Reset after 2 seconds
        setTimeout(() => {
          if (copyIcon) copyIcon.classList.remove('hidden');
          if (checkIcon) checkIcon.classList.add('hidden');
          if (label) label.textContent = 'Copy';
        }, 2000);
      };

      btn.addEventListener('click', handler);
      cleanupFns.push(() => btn.removeEventListener('click', handler));
    });

    return () => cleanupFns.forEach((fn) => fn());
  }, [html]);

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
