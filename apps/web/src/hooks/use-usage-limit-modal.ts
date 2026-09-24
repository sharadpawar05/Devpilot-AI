import { useEffect, useMemo, useState } from 'react';
import { getUsageLimitDetails, isUsageLimitError } from '@/lib/api-error';

export function useUsageLimitModal(error: unknown) {
  const limitError = isUsageLimitError(error);
  const details = useMemo(() => getUsageLimitDetails(error), [error]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (limitError && details) setOpen(true);
  }, [limitError, details]);

  return {
    open,
    setOpen,
    details: limitError ? details : null,
    isLimitError: limitError,
  };
}
