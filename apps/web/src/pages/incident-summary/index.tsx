import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Users,
  GitPullRequest,
  GitCommit,
  Shield,
  Copy,
  Download,
  Loader2,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGitHub } from '@/hooks/use-github';
import { useIncidentSummaryMutation } from '@/lib/incident-summary';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import type { IncidentSeverity, IncidentTimelineEvent, ActionItem } from '@/lib/incident-summary';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const severityColors: Record<IncidentSeverity, string> = {
  P0: 'bg-red-100 text-red-800 border-red-200',
  P1: 'bg-orange-100 text-orange-800 border-orange-200',
  P2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  P3: 'bg-blue-100 text-blue-800 border-blue-200',
};

const timelineTypeIcons: Record<string, string> = {
  detection: 'bg-red-500',
  investigation: 'bg-yellow-500',
  fix: 'bg-blue-500',
  resolution: 'bg-green-500',
  communication: 'bg-purple-500',
  other: 'bg-gray-500',
};

function TimelineEvent({ event }: { event: IncidentTimelineEvent }) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div
          className={cn('h-3 w-3 rounded-full', timelineTypeIcons[event.type] || 'bg-gray-500')}
        />
        <div className="flex-1 w-px bg-border" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{event.event}</span>
          {event.actor && <span className="text-xs text-muted-foreground">by {event.actor}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(event.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{item.title}</h4>
        <span className={cn('px-2 py-0.5 rounded-full text-xs', priorityColors[item.priority])}>
          {item.priority}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
      {item.assignee && (
        <p className="mt-2 text-xs text-muted-foreground">Assignee: {item.assignee}</p>
      )}
    </div>
  );
}

export default function IncidentSummaryPage() {
  const { repositories } = useGitHub();
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('P2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('gemini');

  const { mutate, isPending, data, error } = useIncidentSummaryMutation();

  const result = data?.data;

  const handleGenerate = () => {
    if (!owner || !repo || !incidentTitle || !startDate || !endDate) return;
    mutate({
      owner,
      repo,
      branch,
      incidentTitle,
      severity,
      startDate,
      endDate,
      description,
      provider,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportMarkdown = () => {
    if (!result) return;
    const md = `# Incident Summary: ${result.incidentDetails.title}

## Incident Details
- **Severity:** ${result.incidentDetails.severity}
- **Duration:** ${result.incidentDetails.duration}
- **Status:** ${result.incidentDetails.status}
- **Start:** ${new Date(result.incidentDetails.startDate).toLocaleString()}
- **End:** ${new Date(result.incidentDetails.endDate).toLocaleString()}

## Executive Summary
${result.executiveSummary}

## Impact Assessment
- **Affected Users:** ${result.impactAssessment.affectedUsers}
- **Affected Services:** ${result.impactAssessment.affectedServices.join(', ')}
- **Duration:** ${result.impactAssessment.duration}
- **Business Impact:** ${result.impactAssessment.businessImpact}

## Root Cause
${result.rootCause.summary}
${result.rootCause.contributingFactors.length > 0 ? '\n### Contributing Factors\n' + result.rootCause.contributingFactors.map((f) => `- ${f}`).join('\n') : ''}

## Resolution Summary
${result.resolutionSummary}

## Action Items
${result.actionItems.map((item) => `- [${item.priority}] ${item.title}: ${item.description}`).join('\n')}

## Preventive Recommendations
${result.preventiveRecommendations.map((rec) => `- [${rec.category}] ${rec.title}: ${rec.description}`).join('\n')}

## Related Pull Requests
${result.relatedPullRequests.map((pr) => `- #${pr.number} ${pr.title} (${pr.author})`).join('\n')}

## Related Commits
${result.relatedCommits.map((commit) => `- ${commit.sha} ${commit.message} (${commit.author})`).join('\n')}

---
*Generated at ${new Date(result.generatedAt).toLocaleString()}*
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-summary-${incidentTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Incident Summary Generator</h1>
        <p className="mt-2 text-muted-foreground">
          Generate a comprehensive incident summary with timeline, impact analysis, and preventive
          recommendations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Incident Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Owner</label>
                  <select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select owner</option>
                    {repositories?.map((r: { full_name: string }) => (
                      <option key={r.full_name} value={r.full_name.split('/')[0]}>
                        {r.full_name.split('/')[0]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Repository</label>
                  <select
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select repository</option>
                    {repositories
                      ?.filter(
                        (r: { full_name: string }) => owner && r.full_name.startsWith(owner + '/'),
                      )
                      .map((r: { full_name: string }) => (
                        <option key={r.full_name} value={r.full_name.split('/')[1]}>
                          {r.full_name.split('/')[1]}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className={selectClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Incident Title *</label>
                <input
                  type="text"
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="e.g., Database connection timeout"
                  className={selectClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Severity *</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  className={selectClass}
                >
                  {['P0', 'P1', 'P2', 'P3'].map((s) => (
                    <option key={s} value={s}>
                      {s} -{' '}
                      {s === 'P0'
                        ? 'Critical'
                        : s === 'P1'
                          ? 'High'
                          : s === 'P2'
                            ? 'Medium'
                            : 'Low'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date *</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={selectClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date *</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={selectClass}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional: Describe the incident..."
                  rows={3}
                  className={selectClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium">AI Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className={selectClass}
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!owner || !repo || !incidentTitle || !startDate || !endDate || isPending}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Generate Summary
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-lg font-medium">Generating incident summary...</p>
                  <p className="text-sm text-muted-foreground">
                    Analyzing commits, pull requests, and building timeline
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Error generating summary</p>
                    <p className="text-sm text-red-600">{error.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{result.incidentDetails.title}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(result.executiveSummary)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Summary
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportMarkdown}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Markdown
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'px-2 py-1 rounded text-sm font-bold',
                          severityColors[result.incidentDetails.severity],
                        )}
                      >
                        {result.incidentDetails.severity}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Severity</p>
                        <p className="font-medium">{result.incidentDetails.severity}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="font-medium">{result.incidentDetails.duration}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-medium capitalize">{result.incidentDetails.status}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Contributors</p>
                        <p className="font-medium">{result.contributors.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.executiveSummary) }}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Impact Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Affected Users</p>
                      <p className="font-medium">{result.impactAssessment.affectedUsers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Affected Services</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {result.impactAssessment.affectedServices.map((service) => (
                          <span key={service} className="px-2 py-1 bg-muted rounded text-sm">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Business Impact</p>
                      <p className="font-medium">{result.impactAssessment.businessImpact}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Root Cause</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          result.rootCause.isConfirmed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800',
                        )}
                      >
                        {result.rootCause.isConfirmed ? 'Confirmed' : 'Suspected'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {result.rootCause.confidence}
                      </span>
                    </div>
                    <p className="text-sm">{result.rootCause.summary}</p>
                    {result.rootCause.contributingFactors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">Contributing Factors:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {result.rootCause.contributingFactors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {result.timeline.map((event, i) => (
                      <TimelineEvent key={i} event={event} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {result.relatedPullRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitPullRequest className="h-5 w-5" />
                      Related Pull Requests ({result.relatedPullRequests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.relatedPullRequests.map((pr) => (
                        <div
                          key={pr.number}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{pr.number}
                            </span>
                            <span className="font-medium">{pr.title}</span>
                            <span className="text-sm text-muted-foreground">by {pr.author}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs',
                                pr.confidence === 'high'
                                  ? 'bg-green-100 text-green-800'
                                  : pr.confidence === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800',
                              )}
                            >
                              {pr.confidence}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs',
                                pr.state === 'closed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800',
                              )}
                            >
                              {pr.state}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.relatedCommits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitCommit className="h-5 w-5" />
                      Related Commits ({result.relatedCommits.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.relatedCommits.map((commit) => (
                        <div
                          key={commit.sha}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <span className="font-mono text-sm text-muted-foreground">
                            {commit.sha}
                          </span>
                          <span className="flex-1 text-sm">{commit.message}</span>
                          <span className="text-sm text-muted-foreground">{commit.author}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs',
                              commit.confidence === 'high'
                                ? 'bg-green-100 text-green-800'
                                : commit.confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800',
                            )}
                          >
                            {commit.confidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Contributors ({result.contributors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.contributors.map((contributor) => (
                      <div
                        key={contributor.login}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className="h-8 w-8 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{contributor.login}</p>
                          <p className="text-sm text-muted-foreground">
                            {contributor.contributions} contributions
                          </p>
                        </div>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            contributor.role === 'fixer'
                              ? 'bg-green-100 text-green-800'
                              : contributor.role === 'reviewer'
                                ? 'bg-blue-100 text-blue-800'
                                : contributor.role === 'reporter'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800',
                          )}
                        >
                          {contributor.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resolution Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.resolutionSummary) }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Action Items ({result.actionItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.actionItems.map((item, i) => (
                      <ActionItemCard key={i} item={item} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Preventive Recommendations ({result.preventiveRecommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.preventiveRecommendations.map((rec, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{rec.title}</h4>
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-muted">
                              {rec.category}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs',
                                rec.priority === 'high'
                                  ? 'bg-red-100 text-red-800'
                                  : rec.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800',
                              )}
                            >
                              {rec.priority}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Generated at {new Date(result.generatedAt).toLocaleString()}
              </p>
            </div>
          )}

          {!isPending && !error && !result && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No incident summary yet</p>
                  <p className="text-sm text-muted-foreground">
                    Fill in the incident details and click "Generate Summary" to get started.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
