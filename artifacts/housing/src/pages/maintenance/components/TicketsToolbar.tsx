import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { Search, X, List, LayoutGrid, FileText } from "lucide-react";

interface TicketsToolbarProps {
  ar: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  viewMode: "list" | "kanban";
  onSetViewMode: (mode: "list" | "kanban") => void;
  onExportExcel: () => void;
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
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              ar ? "بحث برقم الغرفة، الوصف، الفني..." : "Search tickets..."
            }
            className="h-8.5 text-xs ps-8 pe-7 bg-background"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

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
