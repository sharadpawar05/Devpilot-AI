import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Github, FileCode, GitPullRequest, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: typeof Github;
  href: string;
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: 'Connect GitHub',
    description: 'Link your GitHub account to access repositories and pull requests',
    icon: Github,
    href: '/github',
  },
  {
    id: 2,
    title: 'Run First Code Review',
    description: 'Paste some code and get AI-powered feedback on quality and issues',
    icon: FileCode,
    href: '/code-review',
  },
  {
    id: 3,
    title: 'Review a Pull Request',
    description: 'Select a PR from your repository and get comprehensive AI analysis',
    icon: GitPullRequest,
    href: '/pull-request-assistant',
  },
  {
    id: 4,
    title: 'Explore Playground',
    description: 'Experiment with different AI models and prompts',
    icon: Play,
    href: '/playground',
  },
];

export const EmptyState = memo(function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Welcome to DevPilot</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by completing these steps to unlock the full power of AI-assisted development.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-md space-y-3">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => navigate(step.href)}
            className="group flex w-full items-center gap-4 rounded-xl border border-input bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate('/playground')}>
          Skip to Playground
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
