import type { HotspotItem } from './types';

const LARGE_FILE_BYTES = 50_000;

export interface HotspotAnalysisResult {
  hotspots: HotspotItem[];
  hotspotCount: number;
}

export function analyzeHotspots(
  commitActivity: Array<{ file: string; count: number }>,
  fileSizes: Map<string, number>,
): HotspotAnalysisResult {
  const changeFrequencyMap = new Map<string, number>();
  for (const entry of commitActivity) {
    const current = changeFrequencyMap.get(entry.file) || 0;
    changeFrequencyMap.set(entry.file, current + entry.count);
  }

  const hotspots: HotspotItem[] = [];

  for (const [path, changeFrequency] of changeFrequencyMap) {
    const sizeBytes = fileSizes.get(path) || 0;
    if (changeFrequency < 3 && sizeBytes < LARGE_FILE_BYTES) continue;

    const frequencyScore = Math.min(changeFrequency / 20, 1);
    const sizeScore = Math.min(sizeBytes / 200_000, 1);
    const churnScore = Math.round((frequencyScore * 0.6 + sizeScore * 0.4) * 100);

    hotspots.push({ path, changeFrequency, sizeBytes, churnScore });
  }

  hotspots.sort((a, b) => b.churnScore - a.churnScore);

  return {
    hotspots: hotspots.slice(0, 10),
    hotspotCount: hotspots.length,
  };
}
