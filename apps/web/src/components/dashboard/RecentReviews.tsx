import { FileCode, GitPullRequest, Play, BarChart3, ExternalLink } from 'lucide-react';

interface ReviewItem {
  id: string;
  type: string;
  repository?: string;
  title?: string;
  provider?: string;
  createdAt?: string;
  url?: string;
}

interface RecentReviewsProps {
  reviews: ReviewItem[];
  onOpen?: (review: ReviewItem) => void;
}

const typeIcons: Record<string, typeof FileCode> = {
  code_review: FileCode,
  pr_review: GitPullRequest,
  pr_assistant: GitPullRequest,
  prompt: Play,
  analysis: BarChart3,
};

const typeLabels: Record<string, string> = {
  code_review: 'Code Review',
  pr_review: 'PR Review',
  pr_assistant: 'PR Assistant',
  prompt: 'Prompt Run',
  analysis: 'Analysis',
};

export function RecentReviews({ reviews, onOpen }: RecentReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Recent Reviews</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileCode className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No reviews yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run your first AI code review to see it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Reviews</h3>
        <span className="text-xs text-muted-foreground">{reviews.length} total</span>
      </div>
      <div className="space-y-2">
        {reviews.slice(0, 5).map((review) => {
          const Icon = typeIcons[review.type] || FileCode;
          return (
            <button
              key={review.id}
              type="button"
              onClick={() => onOpen?.(review)}
              className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="rounded-md bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {review.title || typeLabels[review.type] || review.type}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {review.repository && <span>{review.repository} &middot; </span>}
                  {review.provider && <span>{review.provider} &middot; </span>}
                  {review.createdAt && (
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  )}
                </p>
              </div>
              <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
