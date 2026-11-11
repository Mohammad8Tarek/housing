import { Badge } from "@/components/ui/badge";
import { Wrench, Sparkles } from "lucide-react";

interface TicketsStatusStripProps {
  ar: boolean;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  hasBoth: boolean;
  canViewMnt: boolean;
  canViewHsk: boolean;
  isOnlyMaintenance: boolean;
  isOnlyHousekeeping: boolean;
}

export function TicketsStatusStrip({
  ar,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  totalCount,
  openCount,
  inProgressCount,
  resolvedCount,
  closedCount,
  hasBoth,
  canViewMnt,
  canViewHsk,
  isOnlyMaintenance,
  isOnlyHousekeeping,
}: TicketsStatusStripProps) {
  return (
    <div className="px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              statusFilter === "all"
                ? "bg-primary/10 text-primary border-b-2 border-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span>{ar ? "كل التذاكر" : "All Tickets"}</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold"
            >
              {totalCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              statusFilter === "open"
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{ar ? "مفتوحة" : "Open"}</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
            >
              {openCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("in_progress")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              statusFilter === "in_progress"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b-2 border-amber-500 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{ar ? "قيد التنفيذ" : "In Progress"}</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
            >
              {inProgressCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              statusFilter === "resolved"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{ar ? "تم الحل" : "Resolved"}</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
            >
              {resolvedCount}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              statusFilter === "closed"
                ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-b-2 border-slate-500 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>{ar ? "مغلقة" : "Closed"}</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold"
            >
              {closedCount}
            </Badge>
          </button>
        </div>

        {/* Quick Category Scope Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/30 p-1 rounded-xl border border-border/50 shrink-0">
          {hasBoth && (
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                categoryFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ar ? "الكل" : "All"}
            </button>
          )}
          {canViewMnt && (
            <button
              type="button"
              onClick={() => setCategoryFilter("maintenance")}
              disabled={isOnlyMaintenance}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                categoryFilter === "maintenance"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              } ${isOnlyMaintenance ? "cursor-default opacity-90" : ""}`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{ar ? "أوردرات الصيانة" : "Maintenance"}</span>
              {isOnlyMaintenance && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 h-3.5 bg-amber-700 text-white font-semibold"
                >
                  {ar ? "فقط" : "Only"}
                </Badge>
              )}
            </button>
          )}
          {canViewHsk && (
            <button
              type="button"
              onClick={() => setCategoryFilter("housekeeping")}
              disabled={isOnlyHousekeeping}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                categoryFilter === "housekeeping"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              } ${isOnlyHousekeeping ? "cursor-default opacity-90" : ""}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{ar ? "أوردرات الهاوس كيبنج" : "Housekeeping"}</span>
              {isOnlyHousekeeping && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 h-3.5 bg-sky-700 text-white font-semibold"
                >
                  {ar ? "فقط" : "Only"}
                </Badge>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
