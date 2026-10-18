import { useState } from 'react';
import { useUsage, type UsageData } from '@/hooks/use-usage';
import type { UsageLimitDetails } from '@/lib/api-error';

export function isAiCreditsExhausted(usage: UsageData | undefined | null): boolean {
  if (!usage) return false;
  const limit = usage.limits.aiCredits;
  if (limit <= 0) return false;
  if (usage.usage.aiCredits >= limit) return true;
  const remaining = usage.remaining?.aiCredits;
  return typeof remaining === 'number' && remaining <= 0;
}

export function useAiCreditLimit() {
  const { data: usage } = useUsage();
  const [open, setOpen] = useState(false);

  const exhausted = isAiCreditsExhausted(usage);

  const details: UsageLimitDetails | null =
    exhausted && usage
      ? {
          feature: 'AI_CREDITS',
          used: usage.usage.aiCredits,
          limit: usage.limits.aiCredits,
          resetAt: usage.resetAt ?? usage.periodEnd,
          message: 'Your monthly AI allowance has been used.',
        }
      : null;

  const openLimit = () => {
    if (details) setOpen(true);
  };

  return { exhausted, details, open, setOpen, openLimit };
}
