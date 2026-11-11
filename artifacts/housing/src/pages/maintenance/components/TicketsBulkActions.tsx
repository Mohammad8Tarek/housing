import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash } from "lucide-react";

interface TicketsBulkActionsProps {
  ar: boolean;
  count: number;
  onClear: () => void;
  onExportExcel: () => void;
  canEditAny: boolean;
  canDeleteAny: boolean;
  bulkStatusLoading: boolean;
  onBulkStatusChange: (newStatus: string) => void;
  onBulkDelete: () => void;
}

export function TicketsBulkActions({
  ar,
  count,
  onClear,
  onExportExcel,
  canEditAny,
  canDeleteAny,
  bulkStatusLoading,
  onBulkStatusChange,
  onBulkDelete,
}: TicketsBulkActionsProps) {
  return (
    <BulkActionBar
      count={count}
      onClear={onClear}
      onExportExcel={onExportExcel}
      extraActions={
        canEditAny || canDeleteAny ? (
          <div className="flex items-center gap-2">
            {canEditAny && (
              <Select
                disabled={bulkStatusLoading}
                onValueChange={(val) => onBulkStatusChange(val)}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                  <SelectValue
                    placeholder={
                      ar ? "تغيير الحالة جماعياً..." : "Change Status..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span>{ar ? "مفتوحة" : "Open"}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>{ar ? "قيد التنفيذ" : "In Progress"}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="resolved">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>{ar ? "تم الحل" : "Resolved"}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="closed">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span>{ar ? "مغلقة" : "Closed"}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {canDeleteAny && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onBulkDelete}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <Trash className="w-3.5 h-3.5" />
                {ar ? "حذف المحدد" : "Delete"}
              </Button>
            )}
          </div>
        ) : undefined
      }
      ar={ar}
    />
  );
}
