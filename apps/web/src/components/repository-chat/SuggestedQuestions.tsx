import {
  HelpCircle,
  GitBranch,
  Layers,
  Code,
  FileSearch,
  AlertTriangle,
  BookOpen,
  Rocket,
} from 'lucide-react';

const suggestedQuestions = [
  {
    icon: HelpCircle,
    question: 'Where is authentication implemented?',
    category: 'Architecture',
  },
  {
    icon: Layers,
    question: 'Explain the overall architecture.',
    category: 'Overview',
  },
  {
    icon: GitBranch,
    question: 'How is routing implemented?',
    category: 'Architecture',
  },
  {
    icon: Code,
    question: 'How is state managed?',
    category: 'Patterns',
  },
  {
    icon: FileSearch,
    question: 'Which APIs are available?',
    category: 'API',
  },
  {
    icon: AlertTriangle,
    question: 'Find potential security issues.',
    category: 'Security',
  },
  {
    icon: BookOpen,
    question: 'Generate onboarding documentation.',
    category: 'Docs',
  },
  {
    icon: Rocket,
    question: 'How can performance be improved?',
    category: 'Performance',
  },
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({ onSelect, disabled }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestedQuestions.map((item) => (
        <button
          key={item.question}
          type="button"
          onClick={() => onSelect(item.question)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
        >
          <item.icon className="h-3 w-3 text-muted-foreground" />
          {item.question}
        </button>
      ))}
    </div>
  );
}
