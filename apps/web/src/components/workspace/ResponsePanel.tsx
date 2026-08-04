import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ResponseActionBar, type ResponseMetadata } from './ResponseActionBar';
import { LoadingSkeleton } from '../shared/LoadingSteps';

interface ResponsePanelProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  loadingVariant?: 'text' | 'heading' | 'avatar' | 'card';
  error?: string | null;
  errorNode?: React.ReactNode;
  metadata?: ResponseMetadata | null;
  responseContent?: string;
  filename?: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  showTimestamp?: boolean;
  className?: string;
  contentClassName?: string;
  showMetadataBar?: boolean;
}

const ResponsePanel = forwardRef<HTMLDivElement, ResponsePanelProps>(
  (
    {
      header,
      children,
      footer,
      isEmpty,
      emptyState,
      isLoading,
      loadingVariant = 'card',
      error,
      errorNode,
      metadata,
      responseContent,
      filename,
      isStreaming,
      onRegenerate,
      showTimestamp,
      className,
      contentClassName,
      showMetadataBar = true,
    },
    ref,
  ) => {
    return (
      <div className={cn('flex h-full flex-col overflow-hidden', className)}>
        {header}
        {showMetadataBar && metadata && !isEmpty && !isLoading && (
          <ResponseActionBar
            metadata={metadata}
            responseContent={responseContent}
            filename={filename}
            isStreaming={isStreaming}
            onRegenerate={onRegenerate}
            showTimestamp={showTimestamp}
          />
        )}
        <div ref={ref} className={cn('flex-1 min-h-0 overflow-y-auto', contentClassName)}>
          {error && !errorNode && (
            <div className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {error && errorNode}
          {isLoading && !responseContent && (
            <LoadingSkeleton variant={loadingVariant} className="p-4" />
          )}
          {isEmpty && emptyState ? emptyState : children}
        </div>
        {footer}
      </div>
    );
  },
);
ResponsePanel.displayName = 'ResponsePanel';

export { ResponsePanel };
export type { ResponsePanelProps };
