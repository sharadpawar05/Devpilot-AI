import { memo, useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';

const tips = [
  {
    title: 'Review smaller pull requests',
    description: 'Smaller PRs get higher quality AI feedback. Aim for under 400 lines of changes.',
  },
  {
    title: 'Use code review before committing',
    description: 'Run AI code review on your changes before pushing to catch issues early.',
  },
  {
    title: 'Try the Repository Chat',
    description: 'Ask questions about your codebase structure, dependencies, and architecture.',
  },
  {
    title: 'Review PRs with context',
    description: 'Select the right branch and PR number for the most accurate AI analysis.',
  },
  {
    title: 'Explore the AI Playground',
    description:
      'Experiment with different prompts and models to find what works best for your workflow.',
  },
  {
    title: 'Check repository health',
    description:
      'Use Repository Overview to monitor code quality, dependencies, and project health.',
  },
];

export const TipsCard = memo(function TipsCard() {
  const [currentTip, setCurrentTip] = useState(() => Math.floor(Date.now() / 30000) % tips.length);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const next = useCallback(() => {
    setCurrentTip((prev) => (prev + 1) % tips.length);
  }, []);

  const prev = useCallback(() => {
    setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
  }, []);

  const tip = tips[currentTip];

  return (
    <div className="rounded-2xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Quick Tip</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Previous tip"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={next}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Next tip"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-[48px]">
        <p className="text-sm font-medium">{tip.title}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
      </div>
      <div className="mt-3 flex justify-center gap-1">
        {tips.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentTip(i)}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === currentTip
                ? 'w-4 bg-primary'
                : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`Go to tip ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
});
