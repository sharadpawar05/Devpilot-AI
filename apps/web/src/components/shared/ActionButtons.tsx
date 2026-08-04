import { Check, Copy, Download, RotateCcw, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useCopyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  text: string;
  label?: string;
  resetDelayMs?: number;
}

function CopyButton({ text, label, resetDelayMs, className, ...props }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard(resetDelayMs);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copy(text)}
      className={cn('h-7 px-2 text-xs', className)}
      {...props}
    >
      {copied ? (
        <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="mr-1 h-3.5 w-3.5" />
      )}
      {label ?? (copied ? 'Copied' : 'Copy')}
    </Button>
  );
}

interface DownloadButtonProps extends Omit<ButtonProps, 'onClick'> {
  content: string;
  filename: string;
  mimeType?: string;
  label?: string;
}

function DownloadButton({
  content,
  filename,
  mimeType,
  label,
  className,
  ...props
}: DownloadButtonProps) {
  function handleClick() {
    const blob = new Blob([content], { type: mimeType ?? 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn('h-7 px-2 text-xs', className)}
      {...props}
    >
      <Download className="mr-1 h-3.5 w-3.5" />
      {label ?? 'Download'}
    </Button>
  );
}

interface RegenerateButtonProps extends Omit<ButtonProps, 'onClick'> {
  onRegenerate: () => void;
  isLoading?: boolean;
  label?: string;
}

function RegenerateButton({
  onRegenerate,
  isLoading,
  label,
  className,
  ...props
}: RegenerateButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onRegenerate}
      disabled={isLoading}
      className={cn('h-7 px-2 text-xs', className)}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
      )}
      {label ?? 'Regenerate'}
    </Button>
  );
}

export { CopyButton, DownloadButton, RegenerateButton };
