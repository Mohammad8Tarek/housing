// @ts-nocheck
import { Button } from "@/components/ui/button";
import { X, FileSpreadsheet } from "lucide-react";

interface BulkActionItem {
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface BulkActionBarProps {
  count?: number;
  selectedCount?: number;
  onClear: () => void;
  onExportExcel?: () => void;
  extraActions?: React.ReactNode;
  actions?: BulkActionItem[];
  ar?: boolean;
}

export function BulkActionBar({
  count: propCount,
  selectedCount,
  onClear,
  onExportExcel,
  extraActions,
  actions,
  ar,
}: BulkActionBarProps) {
  const count = propCount ?? selectedCount ?? 0;
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 my-2 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {count}
        </span>
        <span className="text-sm font-semibold truncate">
          {ar
            ? `${count} عنصر محدد`
            : `${count} item${count !== 1 ? "s" : ""} selected`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {onExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/40 font-medium"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {ar ? "تصدير Excel" : "Export Excel"}
          </Button>
        )}
        {actions && actions.map((act, idx) => (
          <Button
            key={idx}
            variant={act.variant || "outline"}
            size="sm"
            onClick={act.onClick}
            disabled={act.disabled}
            className="gap-1.5 font-medium"
          >
            {act.icon}
            {act.label}
          </Button>
        ))}
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
