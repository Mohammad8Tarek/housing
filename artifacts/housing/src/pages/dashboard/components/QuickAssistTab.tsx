import * as React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { type Module } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  BedDouble,
  Building2,
  CalendarPlus,
  Users,
  Wrench,
  FileBarChart2,
  Sparkles,
  UserPlus,
  ShieldCheck,
  Activity,
  SlidersHorizontal,
  ArrowUpRight,
  Zap,
} from "lucide-react";

export interface QuickPageItem {
  id: string;
  nameAr: string;
  nameEn: string;
  path: string;
  module: Module;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const QUICK_PAGES: QuickPageItem[] = [
  {
    id: "accommodation",
    nameAr: "التسكين والمقيمين",
    nameEn: "In-House Guests",
    path: "/accommodation/in-house",
    module: "accommodation",
    icon: BedDouble,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "hover:border-indigo-500/40",
  },
  {
    id: "housing",
    nameAr: "الغرف والمباني",
    nameEn: "Rooms & Buildings",
    path: "/housing",
    module: "housing",
    icon: Building2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "hover:border-emerald-500/40",
  },
  {
    id: "reservations",
    nameAr: "الحجوزات والتسكين",
    nameEn: "Reservations",
    path: "/accommodation/reservations",
    module: "reservations",
    icon: CalendarPlus,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "hover:border-blue-500/40",
  },
  {
    id: "profiles",
    nameAr: "دليل الموظفين",
    nameEn: "Staff Profiles",
    path: "/profiles",
    module: "profiles",
    icon: Users,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "hover:border-violet-500/40",
  },
  {
    id: "maintenance",
    nameAr: "أوامر الصيانة",
    nameEn: "Work Orders",
    path: "/maintenance",
    module: "maintenance",
    icon: Wrench,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40",
  },
  {
    id: "reports",
    nameAr: "مركز التقارير",
    nameEn: "Reports Hub",
    path: "/reports",
    module: "reports",
    icon: FileBarChart2,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "hover:border-cyan-500/40",
  },
  {
    id: "housekeeping",
    nameAr: "النظافة والهاوس كيبنج",
    nameEn: "Housekeeping",
    path: "/housing",
    module: "housekeeping",
    icon: Sparkles,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "hover:border-rose-500/40",
  },
  {
    id: "guest_hosting",
    nameAr: "استضافة الزوار",
    nameEn: "Guest Hosting",
    path: "/accommodation/guest-hosting",
    module: "guest_hosting",
    icon: UserPlus,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "hover:border-teal-500/40",
  },
  {
    id: "users",
    nameAr: "المستخدمين والصلاحيات",
    nameEn: "Users & RBAC",
    path: "/users",
    module: "users",
    icon: ShieldCheck,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "hover:border-purple-500/40",
  },
  {
    id: "activity_log",
    nameAr: "سجل العمليات",
    nameEn: "Activity Log",
    path: "/activity-log",
    module: "activity_log",
    icon: Activity,
    color: "text-zinc-600 dark:text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "hover:border-zinc-500/40",
  },
  {
    id: "settings",
    nameAr: "إعدادات النظام",
    nameEn: "Settings",
    path: "/settings",
    module: "settings",
    icon: SlidersHorizontal,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "hover:border-slate-500/40",
  },
];

/**
 * Clean & Compact Quick Assist Tab inside Daily Operations Hub
 */
export function QuickAssistTab({
  buildNavHref,
}: {
  buildNavHref: (path: string) => string;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { canView, isSuperAdmin } = usePermission();

  const permittedPages = React.useMemo(() => {
    return QUICK_PAGES.filter((page) => isSuperAdmin || canView(page.module));
  }, [canView, isSuperAdmin]);

  if (permittedPages.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        {ar ? "لا توجد صفحات مصرحة لعرضها" : "No permitted pages available"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
      {permittedPages.map((page) => {
        const Icon = page.icon;
        return (
          <Link
            key={page.id}
            href={buildNavHref(page.path)}
            className={cn(
              "group p-3 rounded-xl border border-border/60 bg-card/60 transition-all duration-200",
              "hover:bg-muted/50 hover:shadow-xs hover:-translate-y-0.5 flex items-center justify-between gap-2.5 cursor-pointer select-none",
              page.borderColor,
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  page.bgColor,
                  page.color,
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {ar ? page.nameAr : page.nameEn}
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Sleek Quick Assist Tab Bar for top of Dashboard
 */
export function QuickAssistBar({
  buildNavHref,
}: {
  buildNavHref: (path: string) => string;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { canView, isSuperAdmin } = usePermission();

  const permittedPages = React.useMemo(() => {
    return QUICK_PAGES.filter((page) => isSuperAdmin || canView(page.module));
  }, [canView, isSuperAdmin]);

  if (permittedPages.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-0.5">
      <div className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg shrink-0 border border-amber-500/20 shadow-2xs">
        <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        <span>{ar ? "كويك اسيست:" : "Quick Assist:"}</span>
      </div>
      {permittedPages.map((page) => {
        const Icon = page.icon;
        return (
          <Link
            key={page.id}
            href={buildNavHref(page.path)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer",
              "border border-border/50 bg-card/70 hover:bg-muted hover:border-primary/40 hover:text-primary text-foreground shadow-2xs",
            )}
          >
            <Icon className={cn("w-3.5 h-3.5", page.color)} />
            <span>{ar ? page.nameAr : page.nameEn}</span>
          </Link>
        );
      })}
    </div>
  );
}
