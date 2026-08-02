import { Zap, FileCode, Clock, Coins, Github, Calendar } from 'lucide-react';

interface UsageStats {
  aiRequestsToday: number;
  totalReviews: number;
  avgReviewTime: string;
  tokensUsed: number;
  githubRepos: number;
  connectedSince: string | null;
}

interface UsageStatisticsProps {
  stats: UsageStats;
}

const statCards = [
  {
    key: 'aiRequestsToday' as const,
    label: 'AI Requests Today',
    icon: Zap,
    format: (v: number) => v.toLocaleString(),
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'totalReviews' as const,
    label: 'Total Reviews',
    icon: FileCode,
    format: (v: number) => v.toLocaleString(),
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    key: 'avgReviewTime' as const,
    label: 'Avg Review Time',
    icon: Clock,
    format: (v: string) => v,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    key: 'tokensUsed' as const,
    label: 'Tokens Used',
    icon: Coins,
    format: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()),
    color: 'text-orange-600 dark:text-orange-400',
  },
  {
    key: 'githubRepos' as const,
    label: 'GitHub Repos',
    icon: Github,
    format: (v: number) => v.toLocaleString(),
    color: 'text-gray-600 dark:text-gray-400',
  },
  {
    key: 'connectedSince' as const,
    label: 'Connected Since',
    icon: Calendar,
    format: (v: string | null) => (v ? new Date(v).toLocaleDateString() : 'N/A'),
    color: 'text-pink-600 dark:text-pink-400',
  },
];

export function UsageStatistics({ stats }: UsageStatisticsProps) {
  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Usage Statistics</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.key} className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="mt-2 text-xl font-bold">{card.format(stats[card.key] as never)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
