import { cn } from '@/lib/utils';

interface DiffViewerProps {
  diff: string;
  className?: string;
}

interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'header';
  content: string;
}

function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];

  for (const line of lines) {
    if (line.startsWith('@@')) {
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'added', content: line });
    } else if (line.startsWith('-')) {
      result.push({ type: 'removed', content: line });
    } else if (
      line.startsWith('diff') ||
      line.startsWith('index') ||
      line.startsWith('---') ||
      line.startsWith('+++')
    ) {
      result.push({ type: 'header', content: line });
    } else {
      result.push({ type: 'context', content: line });
    }
  }

  return result;
}

const lineStyles: Record<DiffLine['type'], string> = {
  added: 'bg-green-500/10 text-green-800 dark:text-green-300',
  removed: 'bg-red-500/10 text-red-800 dark:text-red-300',
  header: 'bg-muted/50 text-muted-foreground font-medium',
  context: '',
};

const linePrefix: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  header: ' ',
  context: ' ',
};

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const lines = parseDiff(diff);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-input', className)}>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className={cn('leading-relaxed', lineStyles[line.type])}>
                <td className="w-8 select-none border-r border-input px-2 text-right text-muted-foreground/50">
                  {line.type !== 'header' ? i + 1 : ''}
                </td>
                <td className="whitespace-pre px-3">
                  <span className="mr-2 select-none opacity-50">{linePrefix[line.type]}</span>
                  {line.content.slice(line.type === 'context' ? 0 : 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
