import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileCode, GitPullRequest, Play, MessageSquare, Layout } from 'lucide-react';

const actions = [
  {
    title: 'Review Code',
    description: 'Paste code for AI-powered analysis and feedback',
    icon: FileCode,
    href: '/code-review',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Review Pull Request',
    description: 'Analyze PRs with comprehensive AI reviews',
    icon: GitPullRequest,
    href: '/pull-request-assistant',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'Repository Chat',
    description: 'Ask questions about your codebase',
    icon: MessageSquare,
    href: '/repository-chat',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'AI Playground',
    description: 'Experiment with prompts and AI models',
    icon: Play,
    href: '/playground',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  {
    title: 'Repository Overview',
    description: 'Explore repository structure and health',
    icon: Layout,
    href: '/repository-overview',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
];

export const QuickActions = memo(function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={() => navigate(action.href)}
          className="group flex items-center gap-4 rounded-xl border border-input bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
        >
          <div className={`shrink-0 rounded-lg p-2.5 ${action.color}`}>
            <action.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">
              {action.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {action.description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
});
