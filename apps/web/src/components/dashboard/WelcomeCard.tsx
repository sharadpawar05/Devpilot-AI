import type { AuthUser } from '@devpilot/types';
import { Sparkles } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const messages = [
  'Ready to review your next pull request?',
  "Let's ship some quality code today.",
  'Time to build something great.',
  'Your code deserves a fresh perspective.',
];

function getMessage(): string {
  const idx = Math.floor(Date.now() / 86400000) % messages.length;
  return messages[idx];
}

interface WelcomeCardProps {
  user: AuthUser | null;
}

export function WelcomeCard({ user }: WelcomeCardProps) {
  return (
    <div className="rounded-xl border border-input bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-14 w-14 rounded-full ring-2 ring-primary/20"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="mt-0.5 text-muted-foreground">{getMessage()}</p>
        </div>
      </div>
    </div>
  );
}
