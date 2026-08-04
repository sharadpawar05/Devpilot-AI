import { CheckCircle2, Clock, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationExplanation } from '@/lib/repo-overview';

interface ExplanationCardProps {
  explanation: GenerationExplanation;
  fileName: string;
  className?: string;
}

export function ExplanationCard({ explanation, fileName, className }: ExplanationCardProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div>
        <h4 className="text-sm font-semibold text-foreground">What will this add?</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The generated <span className="font-medium text-foreground">{fileName}</span> will
          include:
        </p>
      </div>

      {/* What it adds */}
      <ul className="space-y-1.5">
        {explanation.whatItAdds.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 border-t border-border/50 pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="font-medium">Execution time:</span>
          <span>{explanation.estimatedExecutionTime}</span>
        </div>
        {explanation.compatibility.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Puzzle className="h-3 w-3" />
            <span className="font-medium">Compatible with:</span>
            <div className="flex flex-wrap gap-1">
              {explanation.compatibility.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
