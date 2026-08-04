import { cn } from '@/lib/utils';

type EmptyStateVariant =
  'playground' | 'code-review' | 'pr-assistant' | 'repository-chat' | 'generic';

interface EmptyStateFeature {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  features?: EmptyStateFeature[];
  hints?: string[];
  actions?: React.ReactNode;
  variant?: EmptyStateVariant;
  className?: string;
}

const variantStyles: Record<
  EmptyStateVariant,
  { gradient: string; border: string; iconColor: string }
> = {
  playground: {
    gradient: 'from-violet-500/20 via-purple-500/10 to-blue-500/5',
    border: 'border-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  'code-review': {
    gradient: 'from-blue-500/20 via-cyan-500/10 to-emerald-500/5',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  'pr-assistant': {
    gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/5',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'repository-chat': {
    gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/5',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  generic: {
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/10',
    iconColor: 'text-primary',
  },
};

function EmptyIllustration({
  variant = 'generic',
  className,
}: {
  variant?: EmptyStateVariant;
  className?: string;
}) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border bg-gradient-to-br',
        styles.gradient,
        styles.border,
        className,
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent dark:from-white/5" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  illustration: Illustration,
  title,
  description,
  features,
  hints,
  actions,
  variant = 'generic',
  className,
}: EmptyStateProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {Illustration ? (
        <Illustration className={cn('mb-5 h-20 w-20', styles.iconColor)} />
      ) : Icon ? (
        <div
          className={cn(
            'mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border bg-gradient-to-br',
            styles.gradient,
            styles.border,
          )}
        >
          <Icon className={cn('h-9 w-9', styles.iconColor)} />
        </div>
      ) : (
        <EmptyIllustration variant={variant} />
      )}

      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <p className="mb-5 max-w-[300px] text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {features && features.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {features.map((feature, i) => {
            const FeatureIcon = feature.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                <FeatureIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {feature.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hints && hints.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          {hints.map((hint, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground"
            >
              {hint}
            </span>
          ))}
        </div>
      )}

      {actions && <div>{actions}</div>}
    </div>
  );
}

export { EmptyState, EmptyIllustration, variantStyles };
export type { EmptyStateProps, EmptyStateVariant, EmptyStateFeature };
