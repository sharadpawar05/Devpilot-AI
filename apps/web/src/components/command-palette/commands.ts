import {
  LayoutDashboard,
  Sparkles,
  Code,
  GitPullRequest,
  MessageSquare,
  History,
  Settings,
  Plug,
  Unplug,
  FolderGit2,
  RefreshCw,
  FileCode,
  BookOpen,
  FlaskConical,
  Search,
  Clock,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  shortcut?: string;
  action: 'navigate' | 'execute';
  href?: string;
  handler?: string;
}

export const commands: Command[] = [
  // Navigation
  {
    id: 'nav:dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    group: 'Navigation',
    action: 'navigate',
    href: '/dashboard',
  },
  {
    id: 'nav:playground',
    label: 'AI Playground',
    icon: Sparkles,
    group: 'Navigation',
    action: 'navigate',
    href: '/playground',
  },
  {
    id: 'nav:code-review',
    label: 'Code Review',
    icon: Code,
    group: 'Navigation',
    action: 'navigate',
    href: '/code-review',
  },
  {
    id: 'nav:pr-assistant',
    label: 'Pull Request Assistant',
    icon: GitPullRequest,
    group: 'Navigation',
    action: 'navigate',
    href: '/pull-request-assistant',
  },
  {
    id: 'nav:repo-chat',
    label: 'Repository Chat',
    icon: MessageSquare,
    group: 'Navigation',
    action: 'navigate',
    href: '/repository-chat',
  },
  {
    id: 'nav:history',
    label: 'History',
    icon: History,
    group: 'Navigation',
    action: 'navigate',
    href: '/history',
  },
  {
    id: 'nav:settings',
    label: 'Settings',
    icon: Settings,
    group: 'Navigation',
    action: 'navigate',
    href: '/settings',
  },

  // GitHub
  {
    id: 'gh:connect',
    label: 'Connect GitHub',
    icon: Plug,
    group: 'GitHub',
    action: 'execute',
    handler: 'gh:connect',
  },
  {
    id: 'gh:disconnect',
    label: 'Disconnect GitHub',
    icon: Unplug,
    group: 'GitHub',
    action: 'execute',
    handler: 'gh:disconnect',
  },
  {
    id: 'gh:switch-repo',
    label: 'Switch Repository',
    icon: FolderGit2,
    group: 'GitHub',
    action: 'execute',
    handler: 'gh:switch-repo',
  },
  {
    id: 'gh:refresh',
    label: 'Refresh Repository',
    icon: RefreshCw,
    group: 'GitHub',
    action: 'execute',
    handler: 'gh:refresh',
  },

  // AI
  {
    id: 'ai:new-playground',
    label: 'New Playground Session',
    icon: Sparkles,
    group: 'AI',
    action: 'execute',
    handler: 'ai:new-playground',
  },
  {
    id: 'ai:review-code',
    label: 'Review Code',
    icon: FileCode,
    group: 'AI',
    action: 'navigate',
    href: '/code-review',
  },
  {
    id: 'ai:review-pr',
    label: 'Review Pull Request',
    icon: GitPullRequest,
    group: 'AI',
    action: 'navigate',
    href: '/pull-request-assistant',
  },
  {
    id: 'ai:gen-docs',
    label: 'Generate Documentation',
    icon: BookOpen,
    group: 'AI',
    action: 'execute',
    handler: 'ai:gen-docs',
  },
  {
    id: 'ai:gen-tests',
    label: 'Generate Tests',
    icon: FlaskConical,
    group: 'AI',
    action: 'execute',
    handler: 'ai:gen-tests',
  },

  // History
  {
    id: 'hist:search',
    label: 'Search History',
    icon: Search,
    group: 'History',
    action: 'navigate',
    href: '/history',
  },
  {
    id: 'hist:recent',
    label: 'Open Recent Session',
    icon: Clock,
    group: 'History',
    action: 'navigate',
    href: '/history',
  },
  {
    id: 'hist:continue',
    label: 'Continue Last Conversation',
    icon: RotateCcw,
    group: 'History',
    action: 'execute',
    handler: 'hist:continue',
  },
];
