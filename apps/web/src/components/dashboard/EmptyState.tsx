import { useNavigate } from 'react-router-dom';
import { Github, FileCode, GitPullRequest, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: typeof Github;
  href: string;
  completed: boolean;
}

export function EmptyState() {
  const navigate = useNavigate();
  const [steps] = useState<OnboardingStep[]>([
    {
      id: 1,
      title: 'Connect GitHub',
      description: 'Link your GitHub account to access repositories and pull requests',
      icon: Github,
      href: '/github',
      completed: false,
    },
    {
      id: 2,
      title: 'Run First Code Review',
      description: 'Paste some code and get AI-powered feedback on quality and issues',
      icon: FileCode,
      href: '/code-review',
      completed: false,
    },
    {
      id: 3,
      title: 'Review a Pull Request',
      description: 'Select a PR from your repository and get comprehensive AI analysis',
      icon: GitPullRequest,
      href: '/pull-request-assistant',
      completed: false,
    },
    {
      id: 4,
      title: 'Explore Playground',
      description: 'Experiment with different AI models and prompts',
      icon: Play,
      href: '/playground',
      completed: false,
    },
  ]);

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Welcome to DevPilot</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by completing these steps to unlock the full power of AI-assisted development.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-md space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
              step.completed
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-input bg-card hover:bg-muted/50'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.completed ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.completed ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>
            {!step.completed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(step.href)}
                className="shrink-0"
              >
                Start
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
