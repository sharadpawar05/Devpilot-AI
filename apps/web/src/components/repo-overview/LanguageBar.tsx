import { cn } from '@/lib/utils';

interface LanguageBarProps {
  languages: Record<string, number>;
  className?: string;
  maxItems?: number;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Sass: '#c6538c',
  Less: '#1d365d',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Markdown: '#083fa1',
  JSON: '#292929',
  YAML: '#cb171e',
  TOML: '#9c4221',
  Shell: '#89e051',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  GraphQL: '#e10098',
  SQL: '#e38c00',
  XML: '#0060ac',
  Lua: '#000080',
  R: '#198CEC',
  Scala: '#c22d40',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
  Perl: '#0298c3',
  MATLAB: '#e16737',
  ObjectiveC: '#438eff',
};

function getLanguageColor(lang: string): string {
  if (LANGUAGE_COLORS[lang]) return LANGUAGE_COLORS[lang];
  let hash = 0;
  for (let i = 0; i < lang.length; i++) {
    hash = lang.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 50%)`;
}

export function LanguageBar({ languages, className, maxItems = 8 }: LanguageBarProps) {
  const entries = Object.entries(languages).sort(([, a], [, b]) => b - a);

  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (totalBytes === 0) return null;

  const displayed = entries.slice(0, maxItems);
  const otherBytes = entries.slice(maxItems).reduce((sum, [, bytes]) => sum + bytes, 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Language breakdown"
      >
        {displayed.map(([lang, bytes]) => {
          const pct = (bytes / totalBytes) * 100;
          return (
            <div
              key={lang}
              style={{ width: `${pct}%`, backgroundColor: getLanguageColor(lang) }}
              className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
              title={`${lang}: ${pct.toFixed(1)}%`}
            />
          );
        })}
        {otherBytes > 0 && (
          <div
            style={{ width: `${(otherBytes / totalBytes) * 100}%`, backgroundColor: '#6b7280' }}
            className="h-full rounded-r-full"
            title={`Other: ${((otherBytes / totalBytes) * 100).toFixed(1)}%`}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
        {displayed.map(([lang, bytes]) => {
          const pct = (bytes / totalBytes) * 100;
          return (
            <div key={lang} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: getLanguageColor(lang) }}
              />
              <span className="truncate font-medium">{lang}</span>
              <span className="ml-auto text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
        {otherBytes > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full bg-gray-500" />
            <span className="truncate font-medium">Other</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {((otherBytes / totalBytes) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
