import { Github, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SuggestedQuestions } from './SuggestedQuestions';

interface DisconnectedStateProps {
  onConnect: () => void;
}

const benefits = [
  'Understand project architecture',
  'Explain code and patterns',
  'Find authentication flow',
  'Generate documentation',
  'Detect duplicate code',
  'Suggest improvements',
];

export function DisconnectedState({ onConnect }: DisconnectedStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <Github className="h-10 w-10 text-muted-foreground" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight">
          Connect GitHub to Chat with Your Codebase
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Connect your GitHub account to ask AI questions about your repositories.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 text-left">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" onClick={onConnect} className="px-8">
            <Github className="mr-2 h-4 w-4" />
            Connect GitHub
          </Button>
          <Button variant="ghost" size="sm" disabled>
            Learn More
          </Button>
        </div>

        <div className="mt-12 border-t border-input pt-8">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Try a suggested question</p>
          <SuggestedQuestions onSelect={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}
