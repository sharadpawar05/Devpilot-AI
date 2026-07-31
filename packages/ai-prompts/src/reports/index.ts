import type { PromptTemplate } from '../types';

export const reportPrompts: PromptTemplate[] = [
  {
    id: 'report_status',
    name: 'Status Report',
    category: 'status_report',
    systemPrompt:
      'You generate engineering status reports. Structure the report with clear sections: Summary, Progress, Risks, Next Steps. Use data-driven language and highlight key metrics.',
    userPromptTemplate:
      'Generate a status report for the following context:\n\nTeam: {{team_name}}\nPeriod: {{period}}\n\nWork completed:\n{{completed}}\n\nWork in progress:\n{{in_progress}}\n\nRisks/Issues:\n{{risks}}',
    variables: [
      { name: 'team_name', description: 'Name of the team', required: true, type: 'string' },
      { name: 'period', description: 'Reporting period', required: true, type: 'string' },
      { name: 'completed', description: 'Completed work items', required: true, type: 'string' },
      {
        name: 'in_progress',
        description: 'In-progress work items',
        required: true,
        type: 'string',
      },
      { name: 'risks', description: 'Known risks or issues', required: false, type: 'string' },
    ],
    temperature: 0.3,
    maxTokens: 3072,
    version: 1,
  },
  {
    id: 'report_incident',
    name: 'Incident Summary',
    category: 'incident_summary',
    systemPrompt:
      'You generate incident summaries following a standard format: Timeline, Impact, Root Cause, Resolution, Action Items. Be factual and avoid speculation.',
    userPromptTemplate:
      'Generate an incident summary:\n\nIncident: {{incident_title}}\nSeverity: {{severity}}\n\nTimeline:\n{{timeline}}\n\nImpact:\n{{impact}}\n\nRoot cause (if known):\n{{root_cause}}\n\nResolution:\n{{resolution}}',
    variables: [
      {
        name: 'incident_title',
        description: 'Title of the incident',
        required: true,
        type: 'string',
      },
      { name: 'severity', description: 'Severity level (P0-P4)', required: true, type: 'string' },
      { name: 'timeline', description: 'Timeline of events', required: true, type: 'string' },
      { name: 'impact', description: 'Impact description', required: true, type: 'string' },
      { name: 'root_cause', description: 'Root cause analysis', required: false, type: 'string' },
      {
        name: 'resolution',
        description: 'Resolution steps taken',
        required: false,
        type: 'string',
      },
    ],
    temperature: 0.2,
    maxTokens: 3072,
    version: 1,
  },
];

export function getReportPrompt(id: string): PromptTemplate | undefined {
  return reportPrompts.find((p) => p.id === id);
}
