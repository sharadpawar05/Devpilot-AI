import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { getAuthErrorCopy, getOAuthErrorFromLocation } from '@/lib/auth-error';
import { Button } from '@/components/ui/button';

export function AuthErrorPage() {
  const location = useLocation();
  const oauthError = getOAuthErrorFromLocation(location.search, location.hash);
  const { title, message } = getAuthErrorCopy(oauthError);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link to="/login">Try again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
