import type { HotspotItem } from './types';

const LARGE_FILE_BYTES = 50_000;

export interface HotspotAnalysisResult {
  hotspots: HotspotItem[];
  hotspotCount: number;
}

function buildReason(changeFrequency: number, lineCount: number): string {
  const reasons: string[] = [];
  if (changeFrequency >= 10) reasons.push('High change frequency');
  else if (changeFrequency >= 5) reasons.push('Moderate change frequency');
  if (lineCount >= 500) reasons.push('Large file');
  else if (lineCount >= 200) reasons.push('Medium-sized file');
  return reasons.length > 0 ? reasons.join(' + ') : 'Elevated churn risk';
}

export function analyzeHotspots(
  commitActivity: Array<{ file: string; count: number }>,
  fileSizes: Map<string, number>,
  fileLineCounts?: Map<string, number>,
): HotspotAnalysisResult {
  const changeFrequencyMap = new Map<string, number>();
  for (const entry of commitActivity) {
    const current = changeFrequencyMap.get(entry.file) || 0;
    changeFrequencyMap.set(entry.file, current + entry.count);
  }

  const hotspots: HotspotItem[] = [];

  for (const [path, changeFrequency] of changeFrequencyMap) {
    const sizeBytes = fileSizes.get(path) || 0;
    const lineCount = fileLineCounts?.get(path) || Math.ceil(sizeBytes / 50);
    if (changeFrequency < 3 && sizeBytes < LARGE_FILE_BYTES) continue;

    const frequencyScore = Math.min(changeFrequency / 20, 1);
    const sizeScore = Math.min(sizeBytes / 200_000, 1);
    const churnScore = Math.round((frequencyScore * 0.6 + sizeScore * 0.4) * 100);

    hotspots.push({
      path,
      score: churnScore,
      commits: changeFrequency,
      lines: lineCount,
      reason: buildReason(changeFrequency, lineCount),
    });
  }

  hotspots.sort((a, b) => b.score - a.score);

  return {
    hotspots: hotspots.slice(0, 10),
    hotspotCount: hotspots.length,
  };
}
