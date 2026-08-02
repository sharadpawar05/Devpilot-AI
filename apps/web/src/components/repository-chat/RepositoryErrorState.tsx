import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RepositoryErrorStateProps {
  error: string;
  repoFullName: string;
  onRetry: () => void;
  onChooseAnother: () => void;
}

export function RepositoryErrorState({
  error,
  repoFullName,
  onRetry,
  onChooseAnother,
}: RepositoryErrorStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <h2 className="text-xl font-bold tracking-tight">Something Went Wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't process <span className="font-medium text-foreground">{repoFullName}</span>
        </p>

        <div className="mt-6 rounded-lg border border-input bg-muted/50 px-4 py-3 text-left">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onRetry} className="px-6">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
          <Button variant="outline" onClick={onChooseAnother} className="px-6">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Choose Another Repository
          </Button>
        </div>
      </div>
    </div>
  );
}
