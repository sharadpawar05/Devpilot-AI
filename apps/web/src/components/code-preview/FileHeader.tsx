import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Share2,
  MoreHorizontal,
  Search,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/lib/clipboard';
import { useDownloadFile } from '@/lib/download';
import { useToast } from '@/components/ui/toast';
import { getLanguageLabel } from './language';

interface FileHeaderProps {
  path: string;
  language: string;
  lineCount: number;
  byteSize?: number;
  content: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onRetry?: () => void;
  className?: string;
}

export function FileHeader({
  path,
  language,
  lineCount,
  byteSize,
  content,
  searchOpen,
  onToggleSearch,
  onRetry,
  className,
}: FileHeaderProps) {
  const fileName = path.split('/').pop() ?? path;
  const dirName = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const { copied, copy } = useCopyToClipboard();
  const { download } = useDownloadFile();
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleCopy = useCallback(() => {
    void copy(content).then(() => {
      addToast('Copied to clipboard', 'success');
    });
  }, [copy, content, addToast]);

  const handleDownload = useCallback(() => {
    download(content, fileName, 'text/plain;charset=utf-8');
    addToast('Download started', 'info');
  }, [download, content, fileName, addToast]);

  const handleShare = useCallback(async () => {
    const shareData = { title: fileName, text: path, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to copy link
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Link copied to clipboard', 'success');
    } catch {
      addToast('Unable to share', 'error');
    }
  }, [fileName, path, addToast]);

  const formatBytes = (bytes?: number): string => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const iconBtnClass =
    'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <header
      className={cn(
        'flex items-center gap-2 border-b border-input bg-card/80 px-3 py-2',
        className,
      )}
      data-testid="code-preview-header"
    >
      <FileCode className="h-4 w-4 shrink-0 text-primary" aria-hidden />

      <div className="min-w-0 flex-1" title={path}>
        <div className="flex items-baseline gap-1.5">
          <span className="truncate font-mono text-sm font-medium" data-testid="file-name">
            {fileName}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {getLanguageLabel(language)}
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground" data-testid="file-path">
          {dirName ? `${dirName}/${fileName}` : fileName}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">
        <span data-testid="line-count">{lineCount} lines</span>
        {byteSize !== undefined && (
          <>
            <span aria-hidden>·</span>
            <span>{formatBytes(byteSize)}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onToggleSearch}
          className={cn(iconBtnClass, searchOpen && 'bg-muted text-foreground')}
          aria-label="Search in file"
          aria-pressed={searchOpen}
          title="Search (Ctrl+F)"
          data-testid="search-toggle"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className={iconBtnClass}
          aria-label={copied ? 'Copied' : 'Copy file contents'}
          title="Copy"
          data-testid="copy-file"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          className={iconBtnClass}
          aria-label="Download file"
          title="Download"
          data-testid="download-file"
        >
          <Download className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={handleShare}
          className={cn(iconBtnClass, 'hidden sm:inline-flex')}
          aria-label="Share file link"
          title="Share"
          data-testid="share-file"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={iconBtnClass}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="More"
            data-testid="more-actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-input bg-popover p-1 shadow-md"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleDownload();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleShare();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                Share link
              </button>
              {onRetry && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onRetry();
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Reload file
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
