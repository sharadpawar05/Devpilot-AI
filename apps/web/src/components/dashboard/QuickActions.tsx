import { useNavigate } from 'react-router-dom';
import { FileCode, GitPullRequest, Play, MessageSquare, Rocket } from 'lucide-react';

const actions = [
  {
    title: 'Code Review',
    description: 'Review code with AI-powered analysis',
    icon: FileCode,
    href: '/code-review',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'PR Assistant',
    description: 'Analyze and document pull requests',
    icon: GitPullRequest,
    href: '/pull-request-assistant',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'AI Playground',
    description: 'Experiment with AI prompts and models',
    icon: Play,
    href: '/playground',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    title: 'GitHub Review',
    description: 'Review PRs directly from GitHub',
    icon: MessageSquare,
    href: '/github',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  {
    title: 'Repository Chat',
    description: 'AI chat about your repositories',
    icon: Rocket,
    href: '/repository-chat',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={() => navigate(action.href)}
          className="group flex flex-col items-center gap-3 rounded-xl border border-input bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
        >
          <div className={`rounded-lg p-3 ${action.color}`}>
            <action.icon className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">{action.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
