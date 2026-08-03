import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  className?: string;
  autoScroll?: boolean;
}

export function StreamingResponse({
  content,
  isStreaming,
  className,
  autoScroll = true,
}: StreamingResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !autoScroll) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [autoScroll]);

  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div ref={containerRef} className={cn('overflow-y-auto whitespace-pre-wrap', className)}>
      {content}
      {isStreaming && <StreamingCursor />}
    </div>
  );
}

function StreamingCursor() {
  return <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground ml-0.5" />;
}
