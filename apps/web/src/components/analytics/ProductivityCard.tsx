import { memo } from 'react';
import { Clock, Code, GitPullRequest, Bug, FileText, MessageSquare } from 'lucide-react';

interface AIUsageStats {
  totalRequests: number;
  repoChats: number;
  playgroundSessions: number;
  codeReviews: number;
  prReviews: number;
  repoAnalyses: number;
  totalTokens: number;
  avgLatency: number;
}

interface ProductivityCardProps {
  aiUsage: AIUsageStats;
}

function estimateHoursSaved(usage: AIUsageStats): number {
  const avgMinutesPerTask = 8;
  return Math.round(((usage.totalRequests * avgMinutesPerTask) / 60) * 10) / 10;
}

function estimateLinesReviewed(usage: AIUsageStats): number {
  return usage.codeReviews * 250 + usage.prReviews * 400;
}

function estimateBugsPrevented(usage: AIUsageStats): number {
  return Math.round(usage.codeReviews * 0.3 + usage.prReviews * 0.5);
}

const metrics = [
  {
    key: 'hoursSaved' as const,
    label: 'Hours Saved',
    icon: Clock,
    color: 'text-emerald-500',
    format: (v: number) => `${v}h`,
  },
  {
    key: 'linesReviewed' as const,
    label: 'Lines Reviewed',
    icon: Code,
    color: 'text-blue-500',
    format: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()),
  },
  {
    key: 'prsImproved' as const,
    label: 'PRs Improved',
    icon: GitPullRequest,
    color: 'text-purple-500',
    format: (v: number) => v.toString(),
  },
  {
    key: 'bugsPrevented' as const,
    label: 'Bugs Prevented',
    icon: Bug,
    color: 'text-red-500',
    format: (v: number) => `~${v}`,
  },
  {
    key: 'docsGenerated' as const,
    label: 'Docs Generated',
    icon: FileText,
    color: 'text-orange-500',
    format: (v: number) => v.toString(),
  },
  {
    key: 'sessionsCompleted' as const,
    label: 'Sessions Completed',
    icon: MessageSquare,
    color: 'text-pink-500',
    format: (v: number) => v.toString(),
  },
];

export const ProductivityCard = memo(function ProductivityCard({ aiUsage }: ProductivityCardProps) {
  const data = {
    hoursSaved: estimateHoursSaved(aiUsage),
    linesReviewed: estimateLinesReviewed(aiUsage),
    prsImproved: aiUsage.prReviews,
    bugsPrevented: estimateBugsPrevented(aiUsage),
    docsGenerated: aiUsage.repoAnalyses,
    sessionsCompleted: aiUsage.totalRequests,
  };

  return (
    <div className="rounded-2xl border border-input bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Productivity Impact</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.key} className="rounded-xl bg-muted/30 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <m.icon className={`h-4 w-4 ${m.color}`} />
              <span className="text-[11px] text-muted-foreground">{m.label}</span>
            </div>
            <p className="mt-2 text-xl font-bold">{m.format(data[m.key])}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
