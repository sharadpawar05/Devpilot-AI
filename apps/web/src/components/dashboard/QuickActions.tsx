import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileCode,
  GitPullRequest,
  Play,
  MessageSquare,
  Layout,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiCreditLimit } from '@/hooks/use-ai-credit-limit';
import { UsageLimitModal } from '@/components/UsageLimitModal';

const actions = [
  {
    title: 'Review Code',
    description: 'Paste code for AI-powered analysis and feedback',
    icon: FileCode,
    href: '/code-review',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    consumesCredits: true,
  },
  {
    title: 'Review Pull Request',
    description: 'Analyze PRs with comprehensive AI reviews',
    icon: GitPullRequest,
    href: '/pull-request-assistant',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    consumesCredits: true,
  },
  {
    title: 'Repository Chat',
    description: 'Ask questions about your codebase',
    icon: MessageSquare,
    href: '/repository-chat',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    consumesCredits: true,
  },
  {
    title: 'AI Playground',
    description: 'Experiment with prompts and AI models',
    icon: Play,
    href: '/playground',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    consumesCredits: true,
  },
  {
    title: 'Repository Overview',
    description: 'Explore repository structure and health',
    icon: Layout,
    href: '/repository-overview',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    consumesCredits: false,
  },
];

export const QuickActions = memo(function QuickActions() {
  const navigate = useNavigate();
  const { exhausted, details, open, setOpen, openLimit } = useAiCreditLimit();

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map((action) => {
          const locked = exhausted && action.consumesCredits;
          return (
            <button
              key={action.title}
              type="button"
              aria-disabled={locked || undefined}
              aria-label={locked ? `${action.title} — AI credits exhausted` : action.title}
              onClick={() => (locked ? openLimit() : navigate(action.href))}
              className={cn(
                'group flex items-center gap-4 rounded-xl border border-input bg-card p-4 text-left shadow-sm transition-all duration-200',
                locked
                  ? 'cursor-not-allowed opacity-70'
                  : 'cursor-pointer hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5',
              )}
            >
              <div className={`shrink-0 rounded-lg p-2.5 ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-semibold transition-colors',
                    !locked && 'group-hover:text-primary',
                  )}
                >
                  {action.title}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-xs line-clamp-1',
                    locked
                      ? 'font-medium text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {locked ? 'AI credits exhausted' : action.description}
                </p>
              </div>
              {locked ? (
                <Lock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5" />
              )}
            </button>
          );
        })}
      </div>
      <UsageLimitModal details={details} open={open} onOpenChange={setOpen} />
    </>
  );
});
