import { useCallback } from 'react';

interface UseDownloadFileReturn {
  download: (content: string, filename: string, mimeType?: string) => void;
  downloadMarkdown: (content: string, prefix?: string) => void;
  downloadJson: (data: unknown, prefix?: string) => void;
}

export function useDownloadFile(): UseDownloadFileReturn {
  const download = useCallback((content: string, filename: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadMarkdown = useCallback(
    (content: string, prefix = 'response') => {
      download(content, `${prefix}-${Date.now()}.md`, 'text/markdown');
    },
    [download],
  );

  const downloadJson = useCallback(
    (data: unknown, prefix = 'data') => {
      download(JSON.stringify(data, null, 2), `${prefix}-${Date.now()}.json`, 'application/json');
    },
    [download],
  );

  return { download, downloadMarkdown, downloadJson };
}
