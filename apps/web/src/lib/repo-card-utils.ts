export function formatRepoSize(kb?: number | null): string {
  if (kb == null || Number.isNaN(kb)) return '—';
  if (kb <= 0) return '0 KB';
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

export function formatStars(count?: number | null): string {
  if (count == null) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return String(count);
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  Ruby: 'bg-rose-500',
  PHP: 'bg-indigo-400',
  'C++': 'bg-pink-500',
  C: 'bg-slate-500',
  'C#': 'bg-purple-500',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-violet-500',
  Dart: 'bg-sky-500',
  Shell: 'bg-emerald-500',
  HTML: 'bg-orange-500',
  CSS: 'bg-sky-400',
  Vue: 'bg-emerald-400',
  Svelte: 'bg-orange-500',
};

export function languageColor(language?: string | null): string {
  if (!language) return 'bg-muted-foreground/50';
  return LANGUAGE_COLORS[language] ?? 'bg-muted-foreground/60';
}
