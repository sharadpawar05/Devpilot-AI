import { useFileContent } from '@/lib/repo-intelligence/queries';
import { CodePreview } from '@/components/code-preview';

interface FilePreviewPanelProps {
  file: string | null;
  owner?: string;
  repo?: string;
  branch?: string;
}

export function FilePreviewPanel({ file, owner = '', repo = '', branch }: FilePreviewPanelProps) {
  const { data, isLoading, isFetching, error, refetch, isError } = useFileContent(
    owner,
    repo,
    file,
    branch,
  );

  if (!file) {
    return <CodePreview file={null} />;
  }

  const hasContext = !!owner && !!repo;
  const loading = isLoading || (isFetching && !data);
  const errorMessage = isError ? error?.message || 'Unable to load file content.' : null;

  return (
    <CodePreview
      file={file}
      content={data?.content ?? null}
      isLoading={loading && hasContext}
      error={errorMessage}
      onRetry={() => void refetch()}
      className="h-full"
    />
  );
}
