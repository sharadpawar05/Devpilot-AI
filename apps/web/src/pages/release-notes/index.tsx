import { useState, useCallback, useEffect } from 'react';
import {
  Tag,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  AlertCircle,
  Users,
  GitPullRequest,
  GitCommit,
  AlertTriangle,
  Lightbulb,
  Copy,
  Download,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHub } from '@/hooks/use-github';
import { useReleaseNotes, useReleaseTags } from '@/lib/release-notes';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { cn } from '@/lib/utils';
import type { ReleaseNotesData, ReleaseNoteItem, ReleaseContributor } from '@/lib/release-notes';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function NoteItemCard({
  item,
  type,
}: {
  item: ReleaseNoteItem;
  type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'issue';
}) {
  const icons = {
    feature: Sparkles,
    fix: XCircle,
    improvement: Zap,
    breaking: AlertTriangle,
    issue: AlertCircle,
  };
  const Icon = icons[type];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="font-medium">{item.title}</h4>
        </div>
        {item.prNumber && <span className="text-xs text-muted-foreground">#{item.prNumber}</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground ml-6">{item.description}</p>
      {item.author && <p className="mt-2 text-xs text-muted-foreground ml-6">by {item.author}</p>}
    </div>
  );
}

function ContributorRow({ contributor }: { contributor: ReleaseContributor }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-3">
      <img src={contributor.avatar_url} alt={contributor.login} className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{contributor.login}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitPullRequest className="h-3 w-3" />
            {contributor.prCount} PRs
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="h-3 w-3" />
            {contributor.commitCount} commits
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReleaseNotesPage() {
  const gh = useGitHub();
  const generateMutation = useReleaseNotes();
  const [selectedRepo, setSelectedRepo] = useState(() => {
    return localStorage.getItem('release-notes-selected-repo') || '';
  });
  const [previousTag, setPreviousTag] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState<ReleaseNotesData | null>(null);

  const owner = selectedRepo.split('/')[0] || '';
  const repo = selectedRepo.split('/')[1] || '';

  const { data: tagsData } = useReleaseTags(owner, repo);
  const tags = tagsData?.tags || [];

  useEffect(() => {
    if (selectedRepo) {
      localStorage.setItem('release-notes-selected-repo', selectedRepo);
    }
  }, [selectedRepo]);

  const handleRepoChange = useCallback(
    (fullName: string) => {
      setSelectedRepo(fullName);
      setPreviousTag('');
      setCurrentTag('');
      setResult(null);
      if (fullName) {
        const [o, r] = fullName.split('/');
        gh.fetchBranches(o, r);
      }
    },
    [gh.fetchBranches],
  );

  const handleGenerate = useCallback(async () => {
    if (!owner || !repo) return;

    try {
      const response = await generateMutation.mutateAsync({
        owner,
        repo,
        previousTag: previousTag || undefined,
        currentTag: currentTag || undefined,
        startDate: useDateRange ? startDate : undefined,
        endDate: useDateRange ? endDate : undefined,
        provider,
      });

      if (response.data) {
        setResult(response.data);
      }
    } catch {
      // Error is handled by the mutation
    }
  }, [
    owner,
    repo,
    previousTag,
    currentTag,
    useDateRange,
    startDate,
    endDate,
    provider,
    generateMutation,
  ]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    await navigator.clipboard.writeText(text);
  }, [result]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `release-notes-${result.releaseVersion}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Release Notes ${result.releaseVersion}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #1a1a1a; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
              h2 { color: #374151; margin-top: 24px; }
              h3 { color: #4b5563; }
              p { line-height: 1.6; color: #4b5563; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <h1>Release Notes ${result.releaseVersion}</h1>
            <p><strong>Release Date:</strong> ${new Date(result.releaseDate).toLocaleDateString()}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <hr />
            ${text.replace(/^## /gm, '<h2>').replace(/^### /gm, '<h3>').replace(/\n/g, '<br />')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [result]);

  const canGenerate =
    selectedRepo && (previousTag || currentTag || useDateRange) && !generateMutation.isPending;

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Release Notes</h1>
          <p className="text-sm text-muted-foreground">
            Generate professional release notes from repository activity.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          Configuration
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="repo" className="text-sm font-medium">
              Repository
            </label>
            <div className="relative">
              <select
                id="repo"
                value={selectedRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
              >
                <option value="">Select repository...</option>
                {gh.repositories.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="previousTag" className="text-sm font-medium">
              Previous Release
            </label>
            <div className="relative">
              <select
                id="previousTag"
                value={previousTag}
                onChange={(e) => setPreviousTag(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
                disabled={!selectedRepo || useDateRange}
              >
                <option value="">Select previous tag...</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="currentTag" className="text-sm font-medium">
              Current Release
            </label>
            <div className="relative">
              <select
                id="currentTag"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
                disabled={!selectedRepo || useDateRange}
              >
                <option value="">Select current tag...</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useDateRange}
              onChange={(e) => setUseDateRange(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Use date range instead
          </label>
        </div>

        {useDateRange && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={selectClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={selectClass}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <div className="space-y-1.5">
            <label htmlFor="provider" className="text-sm font-medium">
              AI Provider
            </label>
            <div className="relative">
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={`${selectClass} w-auto appearance-none pr-10`}
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!canGenerate} className="mt-5">
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Release Notes
              </>
            )}
          </Button>
        </div>

        {generateMutation.isError && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {generateMutation.error?.message || 'Failed to generate release notes'}
          </div>
        )}
      </div>

      {generateMutation.isPending && (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold">Generating Release Notes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing repository activity and generating release notes...
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{result.releaseVersion}</h2>
              <span className="text-sm text-muted-foreground">
                {new Date(result.releaseDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                <RefreshCw
                  className={cn('mr-1.5 h-3.5 w-3.5', generateMutation.isPending && 'animate-spin')}
                />
                Regenerate
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              Executive Summary
            </h2>
            <MarkdownRenderer content={result.executiveSummary} />
          </div>

          {result.newFeatures.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                New Features
              </h2>
              <div className="space-y-3">
                {result.newFeatures.map((item, i) => (
                  <NoteItemCard key={i} item={item} type="feature" />
                ))}
              </div>
            </div>
          )}

          {result.bugFixes.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                Bug Fixes
              </h2>
              <div className="space-y-3">
                {result.bugFixes.map((item, i) => (
                  <NoteItemCard key={i} item={item} type="fix" />
                ))}
              </div>
            </div>
          )}

          {result.improvements.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                Improvements
              </h2>
              <div className="space-y-3">
                {result.improvements.map((item, i) => (
                  <NoteItemCard key={i} item={item} type="improvement" />
                ))}
              </div>
            </div>
          )}

          {result.breakingChanges.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/30">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <AlertTriangle className="h-5 w-5" />
                Breaking Changes
              </h2>
              <div className="space-y-3">
                {result.breakingChanges.map((item, i) => (
                  <NoteItemCard key={i} item={item} type="breaking" />
                ))}
              </div>
            </div>
          )}

          {result.contributors.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Contributors
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.contributors.map((contributor) => (
                  <ContributorRow key={contributor.login} contributor={contributor} />
                ))}
              </div>
            </div>
          )}

          {result.knownIssues.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                Known Issues
              </h2>
              <div className="space-y-3">
                {result.knownIssues.map((item, i) => (
                  <NoteItemCard key={i} item={item} type="issue" />
                ))}
              </div>
            </div>
          )}

          {result.upgradeNotes.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                Upgrade Notes
              </h2>
              <ul className="space-y-2">
                {result.upgradeNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.aiSummary && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-muted-foreground" />
                AI Summary
              </h2>
              <MarkdownRenderer content={result.aiSummary} />
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Generated {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {!result && !generateMutation.isPending && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <Tag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No Release Notes Generated</h3>
          <p className="text-sm text-muted-foreground">
            Select a repository and release tags or date range, then click "Generate Release Notes".
          </p>
        </div>
      )}
    </div>
  );
}

function formatAsMarkdown(data: ReleaseNotesData): string {
  const lines: string[] = [];

  lines.push(`# Release Notes ${data.releaseVersion}`);
  lines.push('');
  lines.push(`**Release Date:** ${new Date(data.releaseDate).toLocaleDateString()}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(data.executiveSummary);
  lines.push('');

  if (data.newFeatures.length > 0) {
    lines.push('## New Features');
    lines.push('');
    for (const item of data.newFeatures) {
      lines.push(`### ${item.title}`);
      lines.push(item.description);
      if (item.prNumber) lines.push(`PR: #${item.prNumber}`);
      if (item.author) lines.push(`Author: ${item.author}`);
      lines.push('');
    }
  }

  if (data.bugFixes.length > 0) {
    lines.push('## Bug Fixes');
    lines.push('');
    for (const item of data.bugFixes) {
      lines.push(`### ${item.title}`);
      lines.push(item.description);
      if (item.prNumber) lines.push(`PR: #${item.prNumber}`);
      if (item.author) lines.push(`Author: ${item.author}`);
      lines.push('');
    }
  }

  if (data.improvements.length > 0) {
    lines.push('## Improvements');
    lines.push('');
    for (const item of data.improvements) {
      lines.push(`### ${item.title}`);
      lines.push(item.description);
      if (item.prNumber) lines.push(`PR: #${item.prNumber}`);
      if (item.author) lines.push(`Author: ${item.author}`);
      lines.push('');
    }
  }

  if (data.breakingChanges.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const item of data.breakingChanges) {
      lines.push(`### ${item.title}`);
      lines.push(item.description);
      if (item.prNumber) lines.push(`PR: #${item.prNumber}`);
      if (item.author) lines.push(`Author: ${item.author}`);
      lines.push('');
    }
  }

  if (data.contributors.length > 0) {
    lines.push('## Contributors');
    lines.push('');
    for (const c of data.contributors) {
      lines.push(`- **${c.login}:** ${c.prCount} PRs, ${c.commitCount} commits`);
    }
    lines.push('');
  }

  if (data.knownIssues.length > 0) {
    lines.push('## Known Issues');
    lines.push('');
    for (const item of data.knownIssues) {
      lines.push(`### ${item.title}`);
      lines.push(item.description);
      lines.push('');
    }
  }

  if (data.upgradeNotes.length > 0) {
    lines.push('## Upgrade Notes');
    lines.push('');
    for (const note of data.upgradeNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  if (data.aiSummary) {
    lines.push('## AI Summary');
    lines.push('');
    lines.push(data.aiSummary);
    lines.push('');
  }

  return lines.join('\n');
}
