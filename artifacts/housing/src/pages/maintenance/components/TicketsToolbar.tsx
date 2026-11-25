import { Button } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { List, LayoutGrid, FileText } from "lucide-react";

interface TicketsToolbarProps {
  ar: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  viewMode: "list" | "kanban";
  onSetViewMode: (mode: "list" | "kanban") => void;
  onExportExcel: () => void;
  isExporting?: boolean;
  cols: any[];
  visible: Set<string>;
  toggle: (key: string, checked: boolean) => void;
  showAll: () => void;
  hideAll: () => void;
}

export function TicketsToolbar({
  ar,
  searchTerm,
  setSearchTerm,
  viewMode,
  onSetViewMode,
  onExportExcel,
  isExporting = false,
  cols,
  visible,
  toggle,
  showAll,
  hideAll,
}: TicketsToolbarProps) {
  return (
    <div className="px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2.5 rounded-xl border shadow-xs">
        {/* Search Box */}
        <DebouncedSearchInput
          className="w-full sm:w-72"
          value={searchTerm}
          onDebouncedChange={setSearchTerm}
          delay={400}
          placeholder={
            ar ? "بحث برقم الغرفة، الوصف، الفني..." : "Search tickets..."
          }
          inputClassName="h-8.5 text-xs bg-background"
        />

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-muted rounded-lg border">
            <button
              type="button"
              onClick={() => onSetViewMode("list")}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={ar ? "عرض الجدول" : "Table View"}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSetViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={ar ? "لوحة كانبان" : "Kanban Board"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={isExporting}
            className="h-8 text-xs gap-1.5 font-medium bg-background"
            title={ar ? "تصدير إلى Excel" : "Export Excel"}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{ar ? "تصدير" : "Export"}</span>
          </Button>

          {/* Toggle Columns */}
          {viewMode === "list" && (
            <ColumnChooser
              cols={cols}
              visible={visible}
              onToggle={toggle}
              onShowAll={showAll}
              onHideAll={hideAll}
              ar={ar}
            />
          )}
        </div>
      </div>
    </div>
  );
}
