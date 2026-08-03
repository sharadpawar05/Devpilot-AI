import { ClipboardPaste, Upload, Trash2, WrapText, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditorToolbarProps {
  onPaste: () => void;
  onUpload: () => void;
  onClear: () => void;
  onFormat: () => void;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  hasCode: boolean;
}

export function EditorToolbar({
  onPaste,
  onUpload,
  onClear,
  onFormat,
  wordWrap,
  onToggleWordWrap,
  isFullscreen,
  onToggleFullscreen,
  hasCode,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPaste}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title="Paste from clipboard"
      >
        <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
        Paste
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUpload}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title="Upload file"
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        Upload
      </Button>
      {hasCode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          title="Clear editor"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onFormat}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title="Format code"
      >
        Format
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleWordWrap}
        className={`h-7 px-2 text-xs ${wordWrap ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
        title="Toggle word wrap"
      >
        <WrapText className="h-3.5 w-3.5 mr-1" />
        Wrap
      </Button>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleFullscreen}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
