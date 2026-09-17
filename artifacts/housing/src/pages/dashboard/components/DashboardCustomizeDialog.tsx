import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SlidersHorizontal,
  RotateCcw,
  Eye,
  EyeOff,
  Lock,
  Search,
  CheckCircle2,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type DashboardWidgetMeta,
  type DashboardWidgetId,
} from "../hooks/useDashboardWidgets";

interface DashboardCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ar: boolean;
  registry: DashboardWidgetMeta[];
  userPreferences: Record<DashboardWidgetId, boolean>;
  widgetPermissions: Record<DashboardWidgetId, boolean>;
  isWidgetVisible: (id: DashboardWidgetId) => boolean;
  toggleWidget: (id: DashboardWidgetId) => void;
  setWidgetVisible: (id: DashboardWidgetId, visible: boolean) => void;
  resetToDefault: () => void;
  enableAll: () => void;
  disableAll: () => void;
  visibleCount: number;
  totalAllowedCount: number;
}

export function DashboardCustomizeDialog({
  open,
  onOpenChange,
  ar,
  registry,
  userPreferences,
  widgetPermissions,
  isWidgetVisible,
  toggleWidget,
  setWidgetVisible,
  resetToDefault,
  enableAll,
  disableAll,
  visibleCount,
  totalAllowedCount,
}: DashboardCustomizeDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  const categories = [
    { id: "all", labelAr: "الكل", labelEn: "All" },
    { id: "kpi", labelAr: "المؤشرات الرقمية (KPIs)", labelEn: "KPI Cards" },
    { id: "operations", labelAr: "العمليات والتشغيل", labelEn: "Operations" },
    { id: "analytics", labelAr: "الرسوم والتحليلات", labelEn: "Analytics" },
    { id: "quick", labelAr: "التنقل السريع", labelEn: "Shortcuts" },
  ];

  const filteredWidgets = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registry.filter((w) => {
      if (selectedCategory !== "all" && w.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const matchAr = w.labelAr.toLowerCase().includes(q) || w.descAr.toLowerCase().includes(q);
        const matchEn = w.labelEn.toLowerCase().includes(q) || w.descEn.toLowerCase().includes(q);
        return matchAr || matchEn;
      }
      return true;
    });
  }, [registry, selectedCategory, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>{ar ? "تخصيص لوحة التحكم" : "Customize Dashboard"}</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {visibleCount} / {totalAllowedCount} {ar ? "نشط" : "active"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? "اختر الأقسام والمؤشرات التي ترغب في عرضها أو إخفائها بما يناسب مهامك وصلاحياتك"
                    : "Select which metrics and operational sections to display based on your workflow and permissions"}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative w-full sm:flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ar ? "بحث في الأقسام والمؤشرات..." : "Search widgets & sections..."}
                className="h-8 text-xs pl-9 rtl:pr-9 rtl:pl-3 rounded-xl border-border/60 bg-background/80"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all whitespace-nowrap",
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {ar ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* List of Widgets */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 divide-y divide-border/40">
          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutGrid className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-medium">
                {ar ? "لا توجد عناصر مطابقة للبحث" : "No matching widgets found"}
              </p>
            </div>
          ) : (
            filteredWidgets.map((widget) => {
              const Icon = widget.icon;
              const hasPerm = widgetPermissions[widget.id] ?? false;
              const isUserEnabled = userPreferences[widget.id] ?? true;
              const isActive = hasPerm && isUserEnabled;

              return (
                <div
                  key={widget.id}
                  className={cn(
                    "pt-3 first:pt-0 flex items-start justify-between gap-4 p-3 rounded-xl transition-all duration-200",
                    !hasPerm
                      ? "opacity-60 bg-muted/20"
                      : isActive
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        !hasPerm
                          ? "bg-muted text-muted-foreground"
                          : isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {ar ? widget.labelAr : widget.labelEn}
                        </span>
                        {!hasPerm && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 px-1.5 py-0 border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>
                              {ar
                                ? `يتطلب صلاحية (${widget.requiredModule})`
                                : `Requires ${widget.requiredModule}`}
                            </span>
                          </Badge>
                        )}
                        {hasPerm && isActive && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 rtl:ml-0.5" />
                            {ar ? "معروض" : "Visible"}
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {ar ? widget.descAr : widget.descEn}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <Switch
                      checked={isUserEnabled && hasPerm}
                      disabled={!hasPerm}
                      onCheckedChange={(checked) => setWidgetVisible(widget.id, checked)}
                      aria-label={ar ? widget.labelAr : widget.labelEn}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="text-xs h-8 gap-1.5 rounded-xl border-border/60 hover:bg-muted"
              title={ar ? "إعادة تعيين كافة الأقسام للوضع الافتراضي" : "Reset to default layout"}
            >
              <RotateCcw className="w-3 h-3 text-muted-foreground" />
              <span>{ar ? "استعادة الافتراضي" : "Reset Defaults"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={enableAll}
              className="text-xs h-8 gap-1 rounded-xl text-primary hover:bg-primary/10"
            >
              <Eye className="w-3 h-3" />
              <span>{ar ? "إظهار الكل" : "Show All"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={disableAll}
              className="text-xs h-8 gap-1 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="w-3 h-3" />
              <span>{ar ? "إخفاء الكل" : "Hide All"}</span>
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-5 rounded-xl font-bold w-full sm:w-auto"
          >
            {ar ? "تم وحفظ التفضيلات" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
