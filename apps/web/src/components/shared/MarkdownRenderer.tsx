import { useEffect, useRef, useMemo } from 'react';
import { renderMarkdown as renderMarkdownUtil } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCopyClick?: () => void;
}

function MarkdownRenderer({ content, className, onCopyClick }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => renderMarkdownUtil(content), [content]);

  useEffect(() => {
    if (!containerRef.current || !onCopyClick) return;

    const buttons = containerRef.current.querySelectorAll('[data-copy-target]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        onCopyClick();
      });
    });
  }, [content, onCopyClick]);

  return (
    <div
      ref={containerRef}
      className={cn('prose prose-sm dark:prose-invert text-sm leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export { MarkdownRenderer };
