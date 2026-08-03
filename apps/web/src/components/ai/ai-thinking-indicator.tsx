import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIThinkingIndicatorProps {
  message?: string;
  className?: string;
}

const THINKING_MESSAGES = [
  'Analyzing request...',
  'Reading repository...',
  'Understanding code...',
  'Reviewing changes...',
  'Generating recommendations...',
  'Processing...',
  'Thinking...',
];

export function AIThinkingIndicator({ message, className }: AIThinkingIndicatorProps) {
  const displayMessage =
    message || THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="animate-pulse">{displayMessage}</span>
    </div>
  );
}
