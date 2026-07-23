// @ts-nocheck
import { Button } from "@/components/ui/button";
import { X, FileSpreadsheet } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onExportExcel?: () => void;
  extraActions?: React.ReactNode;
  ar?: boolean;
}

export function BulkActionBar({
  count,
  onClear,
  onExportExcel,
  extraActions,
  ar,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {count}
        </span>
        <span className="text-sm font-medium truncate">
          {ar
            ? `${count} صف محدد`
            : `${count} row${count !== 1 ? "s" : ""} selected`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {ar ? "تصدير Excel" : "Export Excel"}
          </Button>
        )}
        {extraActions}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
          {ar ? "إلغاء التحديد" : "Clear"}
        </Button>
      </div>
    </div>
  );
}
