import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Radio, Search, CalendarPlus, LogOut } from "lucide-react";
import { IH_COLS } from "../utils/constants";

type Props = {
  ar: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  columns: {
    visible: Set<string>;
    toggle: (key: string, checked: boolean) => void;
    showAll: () => void;
    hideAll: () => void;
  };
  selectedCount: number;
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onBroadcastAll: () => void;
  onBroadcastSelected: () => void;
  onBulkExtend: () => void;
  onBulkCheckout: () => void;
};

export function InHouseToolbar({
  ar,
  search,
  onSearchChange,
  columns,
  selectedCount,
  onClearSelection,
  onExportExcel,
  onExportPDF,
  onBroadcastAll,
  onBroadcastSelected,
  onBulkExtend,
  onBulkCheckout,
}: Props) {
  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "المقيمون حالياً" : "In-House"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <PermissionGate anyPermission={[["whatsapp", "create"], ["accommodation", "edit"]]}>
            <Button
              variant="outline"
              size="sm"
              onClick={onBroadcastAll}
              className="gap-1.5 font-semibold text-xs h-9 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-background shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              {ar ? "إرسال جماعي (واتساب)" : "Broadcast WhatsApp"}
            </Button>
          </PermissionGate>
          <ColumnChooser
            cols={IH_COLS}
            visible={columns.visible}
            onToggle={columns.toggle}
            onShowAll={columns.showAll}
            onHideAll={columns.hideAll}
          />
          <div className="relative flex-1 min-w-[180px] sm:w-52 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                ar ? "بحث بالاسم أو الغرفة..." : "Search by name or room..."
              }
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedCount}
        onClear={onClearSelection}
        onExportExcel={onExportExcel}
        onExportPDF={onExportPDF}
        extraActions={
          <div className="flex items-center gap-2">
            <PermissionGate anyPermission={[["whatsapp", "create"], ["accommodation", "edit"]]}>
              <Button
                variant="outline"
                size="sm"
                onClick={onBroadcastSelected}
                className="gap-1.5 font-semibold text-xs h-8 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 bg-background"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                {ar ? "واتساب للمحددين" : "WhatsApp Selected"}
              </Button>
            </PermissionGate>
            <PermissionGate module="accommodation" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkExtend}
                className="gap-1.5 font-semibold text-xs h-8 text-primary border-primary/30 hover:bg-primary/10 bg-background"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {ar ? "تمديد إقامة جماعي" : "Bulk Extend"}
              </Button>
            </PermissionGate>
            <PermissionGate anyPermission={[["accommodation", "checkout"], ["accommodation", "edit"]]}>
              <Button
                variant="destructive"
                size="sm"
                onClick={onBulkCheckout}
                className="gap-1.5 font-semibold text-xs h-8"
              >
                <LogOut className="w-3.5 h-3.5" />
                {ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
              </Button>
            </PermissionGate>
          </div>
        }
        ar={ar}
      />
    </>
  );
}
