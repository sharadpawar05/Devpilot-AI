import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Engineering AI
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        Automate sprint summaries, PR reviews, and release notes with AI-powered
        engineering management.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link to="/dashboard">Get Started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
