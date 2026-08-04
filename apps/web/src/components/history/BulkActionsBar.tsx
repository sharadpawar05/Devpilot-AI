import { memo } from 'react';
import { Star, Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkActionsBarProps {
  count: number;
  onClearSelection: () => void;
  onFavoriteSelected: () => void;
  onDeleteSelected: () => void;
  onExportSelected?: () => void;
}

export const BulkActionsBar = memo(function BulkActionsBar({
  count,
  onClearSelection,
  onFavoriteSelected,
  onDeleteSelected,
  onExportSelected,
}: BulkActionsBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium text-primary">{count} selected</span>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onFavoriteSelected} className="gap-1.5 text-xs">
          <Star className="h-3.5 w-3.5" />
          Favorite
        </Button>
        {onExportSelected && (
          <Button variant="ghost" size="sm" onClick={onExportSelected} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeleteSelected}
          className="gap-1.5 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="ml-auto gap-1.5 text-xs"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
});
