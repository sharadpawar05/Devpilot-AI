import {
  LayoutDashboard,
  Settings,
  Sparkles,
  Code,
  Github,
  GitPullRequest,
  MessageSquare,
  BookOpen,
  History,
  FolderOpen,
  BarChart3,
  FileText,
  Tag,
  Activity,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useGitHub } from '@/hooks/use-github';
import { useSidebar } from './sidebar-provider';
import { SidebarHeader } from './sidebar-header';
import { SidebarGroup } from './sidebar-group';
import { SidebarFooter } from './sidebar-footer';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'AI',
    items: [
      { label: 'Playground', href: '/playground', icon: Sparkles },
      { label: 'Code Review', href: '/code-review', icon: Code },
      { label: 'Pull Request Assistant', href: '/pull-request-assistant', icon: GitPullRequest },
      { label: 'Repository Chat', href: '/repository-chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Prompt Library',
    items: [{ label: 'Prompt Library', href: '/prompts', icon: BookOpen, disabled: true }],
  },
  {
    label: 'Integrations',
    items: [
      { label: 'Repository Overview', href: '/repository-overview', icon: FolderOpen },
      { label: 'Health Overview', href: '/health-overview', icon: Shield },
      { label: 'Sprint Summary', href: '/sprint-summary', icon: FileText },
      { label: 'Incident Summary', href: '/incident-summary', icon: AlertTriangle },
      { label: 'Release Notes', href: '/release-notes', icon: Tag },
      { label: 'Engineering Status', href: '/engineering-status', icon: Activity },
      { label: 'GitHub', href: '/github', icon: Github },
    ],
  },
  {
    label: 'Activity',
    items: [
      { label: 'History', href: '/history', icon: History },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Settings',
    items: [{ label: 'Settings', href: '/settings', icon: Settings }],
  },
];

function SidebarContent() {
  const { collapsed, isMobile } = useSidebar();
  const gh = useGitHub();

  return (
    <div className="flex h-full flex-col">
      <SidebarHeader />
      <nav
        className={cn(
          'flex-1 space-y-4 overflow-y-auto py-4',
          collapsed && !isMobile ? 'px-2' : 'px-3',
        )}
      >
        {NAV_ITEMS.map((group) => (
          <SidebarGroup
            key={group.label}
            label={group.label}
            items={group.items}
            defaultOpen={group.label === 'AI'}
            collapsible={group.label === 'AI'}
          />
        ))}
      </nav>
      <SidebarFooter gh={gh} />
    </div>
  );
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen, isMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r bg-muted/30 transition-all duration-300 ease-in-out',
          collapsed ? 'w-[64px]' : 'w-[240px]',
        )}
      >
        <SidebarContent />
      </aside>
    </TooltipProvider>
  );
}
