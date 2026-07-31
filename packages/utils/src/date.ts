export function formatDate(date: Date, format: string): string {
  if (format === 'YYYY-MM-DD') {
    return date.toISOString().split('T')[0];
  }

  if (format === 'YYYY-MM-DD HH:mm:ss') {
    return date.toISOString().replace('T', ' ').split('.')[0];
  }

  return date.toLocaleDateString();
}

export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return formatDate(date, 'YYYY-MM-DD');
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
