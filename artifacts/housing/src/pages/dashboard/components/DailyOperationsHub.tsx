import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import {
  CalendarCheck,
  Clock,
  Wrench,
  FileWarning,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface DailyOperationsHubProps {
  checkIns?: any[];
  checkOuts?: any[];
  maintenanceRequests?: any[];
  expiringContracts?: any[];
  buildNavHref: (path: string) => string;
}

export function DailyOperationsHub({
  checkIns = [],
  checkOuts = [],
  maintenanceRequests = [],
  expiringContracts = [],
  buildNavHref,
}: DailyOperationsHubProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [activeTab, setActiveTab] = React.useState<"checkouts" | "checkins" | "maintenance" | "contracts">("checkouts");

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {ar ? "مركز العمليات والنبض اليومي" : "Daily Operations Pulse"}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {ar
              ? "متابعة إجراءات الإخلاء، الوصول، الصيانة الحرجة، وتجديد العقود"
              : "Live pipeline of departures, arrivals, work orders, and contract renewals"}
          </CardDescription>
        </div>

        {/* Tab Controls */}
        <div className="bg-muted/70 p-1 rounded-xl border border-border/40 self-start sm:self-auto h-auto flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab("checkouts")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
              activeTab === "checkouts"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{ar ? "المغادرات" : "Departures"}</span>
            {checkOuts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold font-mono">
                {checkOuts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("checkins")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
              activeTab === "checkins"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>{ar ? "القادمون" : "Arrivals"}</span>
            {checkIns.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-bold font-mono">
                {checkIns.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("maintenance")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
              activeTab === "maintenance"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Wrench className="w-3.5 h-3.5 text-orange-500" />
            <span>{ar ? "الصيانة" : "Maintenance"}</span>
            {maintenanceRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[10px] font-bold font-mono">
                {maintenanceRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("contracts")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
              activeTab === "contracts"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileWarning className="w-3.5 h-3.5 text-purple-500" />
            <span>{ar ? "العقود" : "Contracts"}</span>
            {expiringContracts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-bold font-mono">
                {expiringContracts.length}
              </span>
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-2 flex-1 overflow-auto min-h-[260px] max-h-[320px]">
        {/* TAB 1: CHECKOUTS / DEPARTURES */}
        {activeTab === "checkouts" && (
          <div className="space-y-2">
            {checkOuts && checkOuts.length > 0 ? (
              checkOuts.slice(0, 8).map((alert, i) => (
                <Link key={i} href={buildNavHref("/accommodation/in-house")}>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "p-1.5 rounded-full flex-shrink-0",
                          alert.daysRemaining <= 1
                            ? "bg-red-100 text-red-600 dark:bg-red-950/40"
                            : alert.daysRemaining <= 3
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                          {alert.profileName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {alert.buildingName ? `${alert.buildingName}, ` : ""}{ar ? "الغرفة" : "Room"} {alert.roomNumber}
                          {alert.department ? ` · ${alert.department}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-end shrink-0 whitespace-nowrap">
                      <p
                        className={cn(
                          "text-xs font-bold font-mono",
                          alert.daysRemaining <= 1
                            ? "text-red-600 dark:text-red-400"
                            : alert.daysRemaining <= 3
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-foreground",
                        )}
                      >
                        {alert.daysRemaining < 0
                          ? ar
                            ? "إخلاء متأخر"
                            : "Overdue"
                          : alert.daysRemaining === 0
                          ? ar
                            ? "اليوم"
                            : "Today"
                          : `${alert.daysRemaining}d`}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(alert.expectedCheckOutDate)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="h-full min-h-[160px] flex items-center justify-center text-muted-foreground text-xs flex-col gap-2 pt-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  {ar ? "لا مغادرات قادمة مجدولة خلال الـ 7 أيام القادمة" : "No upcoming checkouts scheduled in next 7 days"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHECKINS / ARRIVALS */}
        {activeTab === "checkins" && (
          <div className="space-y-2">
            {checkIns && checkIns.length > 0 ? (
              checkIns.slice(0, 8).map((cin, i) => (
                <Link key={i} href={buildNavHref("/accommodation/reservations")}>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/40 flex-shrink-0">
                        <CalendarCheck className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                          {cin.guestName || (ar ? "حجز بدون اسم" : "Unnamed Booking")}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {cin.buildingName ? `${cin.buildingName}, ` : ""}{ar ? "الغرفة:" : "Room:"} {cin.roomNumber || "TBD"}
                          {cin.department ? ` · ${cin.department}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-end shrink-0 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          cin.daysUntil <= 0
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {cin.daysUntil === 0
                          ? ar
                            ? "يصل اليوم"
                            : "Arriving Today"
                          : cin.daysUntil === 1
                          ? ar
                            ? "يصل غداً"
                            : "Tomorrow"
                          : `+${cin.daysUntil}d`}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {formatDate(cin.checkInDate)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="h-full min-h-[160px] flex items-center justify-center text-muted-foreground text-xs flex-col gap-2 pt-4">
                <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-60" />
                <p className="font-medium text-blue-600 dark:text-blue-400">
                  {ar ? "لا وصول قادم خلال الأسبوع الحالي" : "No pending arrivals in the next 7 days"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MAINTENANCE TICKETS */}
        {activeTab === "maintenance" && (
          <div className="space-y-2">
            {maintenanceRequests && maintenanceRequests.length > 0 ? (
              maintenanceRequests.slice(0, 8).map((m, i) => (
                <Link key={i} href={buildNavHref("/maintenance")}>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "p-1.5 rounded-full flex-shrink-0",
                          m.priority === "emergency" || m.priority === "high"
                            ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40"
                            : "bg-amber-100 text-amber-600 dark:bg-amber-950/40",
                        )}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                          {m.problemType || (ar ? "طلب صيانة" : "Maintenance Order")}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.buildingName ? `${m.buildingName}, ` : ""}{ar ? "الغرفة" : "Room"} {m.roomNumber}
                          {m.description ? ` · ${m.description}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-end shrink-0 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase font-bold",
                          m.priority === "emergency"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            : m.priority === "high"
                            ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/30",
                        )}
                      >
                        {m.priority || "open"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="h-full min-h-[160px] flex items-center justify-center text-muted-foreground text-xs flex-col gap-2 pt-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  {ar ? "لا توجد بلاغات صيانة مفتوحة حالياً" : "All maintenance tickets resolved!"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPIRING CONTRACTS */}
        {activeTab === "contracts" && (
          <div className="space-y-2">
            {expiringContracts && expiringContracts.length > 0 ? (
              expiringContracts.slice(0, 8).map((c, i) => (
                <Link key={i} href={buildNavHref("/profiles")}>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/40 flex-shrink-0">
                        <FileWarning className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.department ? `${c.department} · ` : ""}{c.jobTitle || (ar ? "موظف" : "Staff")}
                        </p>
                      </div>
                    </div>

                    <div className="text-end shrink-0 whitespace-nowrap">
                      <p
                        className={cn(
                          "text-xs font-bold font-mono",
                          c.daysUntil <= 7 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {c.daysUntil <= 0
                          ? ar
                            ? "منتهي"
                            : "Expired"
                          : `${c.daysUntil}d ${ar ? "متبقي" : "left"}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(c.contractEndDate)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="h-full min-h-[160px] flex items-center justify-center text-muted-foreground text-xs flex-col gap-2 pt-4">
                <CheckCircle2 className="h-8 w-8 text-purple-500 opacity-60" />
                <p className="font-medium text-purple-600 dark:text-purple-400">
                  {ar ? "لا عقود تنتهي خلال الـ 30 يوماً القادمة" : "No employee contracts expiring in next 30 days"}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
