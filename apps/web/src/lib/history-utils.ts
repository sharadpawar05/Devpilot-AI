export type TimeGroup = 'today' | 'yesterday' | 'last7days' | 'lastmonth' | 'older';

export interface GroupedSessions {
  key: TimeGroup;
  label: string;
  sessions: Array<{
    id: string;
    workflowType: string;
    repository?: string;
    title: string;
    provider: string;
    model: string;
    totalLatency: number;
    totalTokens: number;
    messageCount: number;
    pinned: boolean;
    archived: boolean;
    favorite: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

type SessionItem = GroupedSessions['sessions'][number];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTimeGroup(dateStr: string): TimeGroup {
  const date = startOfDay(new Date(dateStr));
  const now = startOfDay(new Date());
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'last7days';
  if (diffDays <= 30) return 'lastmonth';
  return 'older';
}

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 Days',
  lastmonth: 'Last Month',
  older: 'Older',
};

const GROUP_ORDER: TimeGroup[] = ['today', 'yesterday', 'last7days', 'lastmonth', 'older'];

export function groupSessionsByTime(sessions: SessionItem[]): GroupedSessions[] {
  const pinned: SessionItem[] = [];
  const byGroup: Record<TimeGroup, SessionItem[]> = {
    today: [],
    yesterday: [],
    last7days: [],
    lastmonth: [],
    older: [],
  };

  for (const session of sessions) {
    if (session.pinned) {
      pinned.push(session);
      continue;
    }
    const group = getTimeGroup(session.createdAt);
    byGroup[group].push(session);
  }

  const result: GroupedSessions[] = [];

  if (pinned.length > 0) {
    result.push({ key: 'today', label: 'Pinned', sessions: pinned });
  }

  for (const key of GROUP_ORDER) {
    if (byGroup[key].length > 0) {
      result.push({
        key,
        label: GROUP_LABELS[key],
        sessions: byGroup[key],
      });
    }
  }

  return result;
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}
