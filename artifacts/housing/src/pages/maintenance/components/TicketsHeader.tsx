import { Button } from "@/components/ui/button";
import { Plus, Wrench, Sparkles, Layers } from "lucide-react";

interface TicketsHeaderProps {
  ar: boolean;
  isOnlyHousekeeping: boolean;
  isOnlyMaintenance: boolean;
  canCreateAny: boolean;
  onCreate: () => void;
}

export function TicketsHeader({
  ar,
  isOnlyHousekeeping,
  isOnlyMaintenance,
  canCreateAny,
  onCreate,
}: TicketsHeaderProps) {
  return (
    <div className="px-4 sm:px-6 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shadow-xs ${
              isOnlyHousekeeping
                ? "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
                : isOnlyMaintenance
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
            }`}
          >
            {isOnlyHousekeeping ? (
              <Sparkles className="w-6 h-6" />
            ) : isOnlyMaintenance ? (
              <Wrench className="w-6 h-6" />
            ) : (
              <Layers className="w-6 h-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isOnlyHousekeeping
                ? ar
                  ? "طلبات وأوامر الهاوس كيبنج"
                  : "Housekeeping Orders"
                : isOnlyMaintenance
                  ? ar
                    ? "بلاغات وأوامر الصيانة الفنية"
                    : "Maintenance Work Orders"
                  : ar
                    ? "مركز التذاكر وأوامر العمل"
                    : "Operations & Tickets Hub"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOnlyHousekeeping
                ? ar
                  ? "متابعة وإسناد طلبات النظافة وتجهيز الغرف والمستلزمات"
                  : "Track and assign room cleaning, linens, and housekeeping orders"
                : isOnlyMaintenance
                  ? ar
                    ? "متابعة وإسناد بلاغات الأعطال والصيانة الوقائية والطارئة"
                    : "Track and dispatch engineering and repair work orders"
                  : ar
                    ? "متابعة وإسناد أوامر العمل وبلاغات الصيانة والنظافة"
                    : "Track and assign work orders, maintenance, and housekeeping"}
            </p>
          </div>
        </div>

        {/* Action Bar: Create Ticket */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canCreateAny && (
            <Button
              onClick={onCreate}
              className="gap-2 shadow-xs font-semibold"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isOnlyHousekeeping
                  ? ar
                    ? "طلب هاوس كيبنج جديد"
                    : "New Housekeeping Order"
                  : isOnlyMaintenance
                    ? ar
                      ? "بلاغ صيانة جديد"
                      : "New Maintenance Ticket"
                    : ar
                      ? "إنشاء تذكرة جديدة"
                      : "New Ticket"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
