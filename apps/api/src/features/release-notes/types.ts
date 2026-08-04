// ─── Release Notes Types ─────────────────────────────────────────────────────

export interface ReleaseNotesRequest {
  owner: string;
  repo: string;
  previousTag?: string;
  currentTag?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface ReleaseNoteItem {
  title: string;
  description: string;
  prNumber?: number;
  prUrl?: string;
  author?: string;
}

export interface ReleaseContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  prCount: number;
  commitCount: number;
}

export interface ReleaseNotesData {
  releaseVersion: string;
  releaseDate: string;
  executiveSummary: string;
  newFeatures: ReleaseNoteItem[];
  bugFixes: ReleaseNoteItem[];
  improvements: ReleaseNoteItem[];
  breakingChanges: ReleaseNoteItem[];
  contributors: ReleaseContributor[];
  knownIssues: ReleaseNoteItem[];
  upgradeNotes: string[];
  aiSummary: string;
}

export interface ReleaseNotesResponse {
  success: boolean;
  data?: ReleaseNotesData;
  error?: {
    code: string;
    message: string;
  };
  latencyMs?: number;
  provider?: string;
  model?: string;
}

export interface ReleaseTag {
  name: string;
  commitSha: string;
  date: string;
}
