import { useMemo, useRef, useEffect, useCallback, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { highlightCode } from './highlight';

interface CodeDisplayProps {
  content: string;
  language: string;
  activeLine: number | null;
  searchQuery: string;
  activeMatchIndex: number;
  onLineClick?: (lineNumber: number) => void;
  onActiveLineChange?: (lineNumber: number) => void;
  className?: string;
}

interface ParsedLine {
  lineNumber: number;
  segments: Array<{ text: string; className?: string }>;
}

function parseHighlightedLines(highlightedHtml: string): ParsedLine[] {
  if (!highlightedHtml) return [{ lineNumber: 1, segments: [{ text: ' ' }] }];

  const lines: ParsedLine[] = [];
  const rawLines = highlightedHtml.split('\n');
  let openTags: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineHtml = rawLines[i];
    const closeTags = openTags
      .slice()
      .reverse()
      .map((tag) => {
        const nameMatch = tag.match(/^<(\w+)/);
        return nameMatch ? `</${nameMatch[1]}>` : '';
      })
      .join('');
    const wrapped = openTags.join('') + lineHtml + closeTags;

    const temp = document.createElement('div');
    temp.innerHTML = wrapped;

    const segments: ParsedLine['segments'] = [];
    if (temp.childNodes.length === 0) {
      segments.push({ text: ' ' });
    } else {
      temp.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent ?? '';
          if (text || segments.length === 0) segments.push({ text: text || ' ' });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          segments.push({ text: el.textContent ?? '', className: el.className || undefined });
        }
      });
    }

    lines.push({ lineNumber: i + 1, segments });
    openTags = updateOpenTags(lineHtml, openTags);
  }

  return lines;
}

function updateOpenTags(html: string, prevOpen: string[]): string[] {
  const tagStack: string[] = [...prevOpen];
  const scanRegex = /<(\/?)(\w+)(\s[^>]*?)?(\/)?>/g;
  let m: RegExpExecArray | null;
  while ((m = scanRegex.exec(html)) !== null) {
    const full = m[0];
    const closing = m[1];
    const name = m[2];
    const selfClose = m[4];
    if (selfClose === '/') continue;
    if (closing === '/') {
      for (let i = tagStack.length - 1; i >= 0; i--) {
        const openName = (tagStack[i].match(/^<(\w+)/) ?? [])[1];
        if (openName === name) {
          tagStack.splice(i, 1);
          break;
        }
      }
    } else {
      tagStack.push(full);
    }
  }
  return tagStack;
}

function renderSegmentsWithSearch(
  segments: ParsedLine['segments'],
  searchQuery: string,
  isSearchActive: boolean,
): ReactNode[] {
  if (!searchQuery || !isSearchActive) {
    return segments.map((seg, i) =>
      seg.className ? (
        <span key={i} className={seg.className}>
          {seg.text}
        </span>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    );
  }

  const nodes: ReactNode[] = [];
  const query = searchQuery;

  segments.forEach((seg, si) => {
    const parts = seg.text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
    parts.forEach((part, pi) => {
      if (!part) return;
      if (part.toLowerCase() === query.toLowerCase()) {
        nodes.push(
          <mark key={`s-${si}-p-${pi}`} className="code-search-match">
            {part}
          </mark>,
        );
      } else {
        nodes.push(
          <span key={`s-${si}-p-${pi}`} className={seg.className}>
            {part}
          </span>,
        );
      }
    });
  });

  return nodes;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function CodeDisplay({
  content,
  language,
  activeLine,
  searchQuery,
  activeMatchIndex,
  onLineClick,
  onActiveLineChange,
  className,
}: CodeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localActiveLine, setLocalActiveLine] = useState<number | null>(activeLine);

  const highlightedHtml = useMemo(() => highlightCode(content, language), [content, language]);
  const lines = useMemo(() => parseHighlightedLines(highlightedHtml), [highlightedHtml]);
  const plainLines = useMemo(() => content.split('\n'), [content]);

  const matchLineNumbers = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const result: number[] = [];
    plainLines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) result.push(i + 1);
    });
    return result;
  }, [plainLines, searchQuery]);

  const effectiveActiveLine = activeLine ?? localActiveLine;

  useEffect(() => {
    if (activeMatchIndex < 0 || matchLineNumbers.length === 0) return;
    const idx = activeMatchIndex % matchLineNumbers.length;
    const lineNum = matchLineNumbers[idx];
    if (lineNum && lineNum !== effectiveActiveLine) {
      setLocalActiveLine(lineNum);
      onActiveLineChange?.(lineNum);
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-line="${lineNum}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeMatchIndex, matchLineNumbers, effectiveActiveLine, onActiveLineChange]);

  const handleLineClick = useCallback(
    (lineNumber: number) => {
      setLocalActiveLine(lineNumber);
      onLineClick?.(lineNumber);
    },
    [onLineClick],
  );

  return (
    <div
      ref={containerRef}
      className={cn('code-display relative min-h-0 flex-1 overflow-auto', className)}
      data-testid="code-display"
      role="region"
      aria-label="Code content"
      tabIndex={0}
    >
      <pre className="code-pre m-0 min-w-full p-0">
        <code className="block font-mono text-[13px] leading-[1.55]">
          {lines.map((line) => {
            const isActive = effectiveActiveLine === line.lineNumber;
            return (
              <div
                key={line.lineNumber}
                data-line={line.lineNumber}
                className={cn('code-line group', isActive && 'code-line-active')}
                onClick={() => handleLineClick(line.lineNumber)}
              >
                <button
                  type="button"
                  className="code-line-number"
                  aria-label={`Line ${line.lineNumber}`}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLineClick(line.lineNumber);
                  }}
                >
                  {line.lineNumber}
                </button>
                <span className="code-line-content">
                  {renderSegmentsWithSearch(
                    line.segments,
                    searchQuery,
                    matchLineNumbers.includes(line.lineNumber),
                  )}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
