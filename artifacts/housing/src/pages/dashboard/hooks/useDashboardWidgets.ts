import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/hooks/use-permission";
import {
  Users,
  Building2,
  BedDouble,
  Wrench,
  CalendarCheck,
  Activity,
  Layers,
  BarChart3,
  Sparkles,
  PieChart,
  Home,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export type DashboardWidgetId =
  | "quick_assist"
  | "kpi_profiles"
  | "kpi_rooms"
  | "kpi_beds"
  | "kpi_maintenance"
  | "kpi_arrivals"
  | "readiness_tracker"
  | "capacity_ribbon"
  | "donut_analytics"
  | "department_list"
  | "gender_demographics"
  | "building_charts"
  | "capacity_matrix"
  | "daily_operations"
  | "housekeeping_queue";

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  category: "kpi" | "operations" | "analytics" | "quick";
  requiredModule?: string;
  requiredAction?: string;
  icon: LucideIcon;
  defaultVisible: boolean;
}

export const DASHBOARD_WIDGETS_REGISTRY: DashboardWidgetMeta[] = [
  // Quick Bar
  {
    id: "quick_assist",
    labelAr: "شريط التنقل السريع",
    labelEn: "Quick Navigation Bar",
    descAr: "أزرار الوصول السريع لأقسام السكن والحجوزات والصيانة والتقارير",
    descEn: "Quick shortcut bar to housing, reservations, maintenance, and reports",
    category: "quick",
    icon: Sparkles,
    defaultVisible: true,
  },
  // KPIs
  {
    id: "kpi_profiles",
    labelAr: "مؤشر إجمالي العاملين والمقيمين",
    labelEn: "Total Profiles KPI",
    descAr: "إجمالي الموظفين المسجلين والمقيمين وغير المقيمين",
    descEn: "Total registered profiles, active, and unhoused counts",
    category: "kpi",
    requiredModule: "profiles",
    requiredAction: "view",
    icon: Users,
    defaultVisible: true,
  },
  {
    id: "kpi_rooms",
    labelAr: "مؤشر إجمالي الغرف السكنية",
    labelEn: "Total Rooms KPI",
    descAr: "عدد الغرف الإجمالي والمشغول والمتاح",
    descEn: "Total rooms, occupied, and available counts",
    category: "kpi",
    requiredModule: "housing",
    requiredAction: "view",
    icon: Building2,
    defaultVisible: true,
  },
  {
    id: "kpi_beds",
    labelAr: "مؤشر سعة وإشغال الأسرة",
    labelEn: "Bed Capacity & Occupancy KPI",
    descAr: "إجمالي سعة الأسرة ونسبة إشغالها الفعلية",
    descEn: "Total bed capacity and actual bed occupancy percentage",
    category: "kpi",
    requiredModule: "housing",
    requiredAction: "view",
    icon: BedDouble,
    defaultVisible: true,
  },
  {
    id: "kpi_maintenance",
    labelAr: "مؤشر بلاغات الصيانة المفتوحة",
    labelEn: "Open Maintenance Tickets KPI",
    descAr: "عدد البلاغات والأعطال الجارية وقيد المعالجة",
    descEn: "Active pending engineering maintenance tickets",
    category: "kpi",
    requiredModule: "maintenance",
    requiredAction: "view",
    icon: Wrench,
    defaultVisible: true,
  },
  {
    id: "kpi_arrivals",
    labelAr: "مؤشر المتوقع وصولهم اليوم",
    labelEn: "Expected Arrivals KPI",
    descAr: "حجوزات التسكين المؤكدة المقرر وصولها اليوم",
    descEn: "Confirmed arrivals scheduled for today",
    category: "kpi",
    requiredModule: "reservations",
    requiredAction: "view",
    icon: CalendarCheck,
    defaultVisible: true,
  },
  // Operations & Trackers
  {
    id: "readiness_tracker",
    labelAr: "شريط تتبع جاهزية ونظافة الغرف",
    labelEn: "Room Readiness & Turnover Tracker",
    descAr: "متابعة الغرف الجاهزة والمتسخة ونسبة جاهزية الإشراف الداخلي",
    descEn: "Live tracking of clean, dirty, inspected, and turnover health",
    category: "operations",
    requiredModule: "housekeeping",
    requiredAction: "view",
    icon: Activity,
    defaultVisible: true,
  },
  {
    id: "capacity_ribbon",
    labelAr: "شريط السعة الاستيعابية للمباني والأدوار",
    labelEn: "Building & Floor Capacity Ribbon",
    descAr: "ملخص معماري فوري لعدد المباني، الأدوار، الغرف، والأسرة الشاغرة",
    descEn: "Architectural ribbon showing buildings, floors, rooms, and vacant beds",
    category: "operations",
    requiredModule: "housing",
    requiredAction: "view",
    icon: Home,
    defaultVisible: true,
  },
  {
    id: "daily_operations",
    labelAr: "مركز العمليات وحركات اليوم (Hub)",
    labelEn: "Daily Operations Hub",
    descAr: "تسجيلات الدخول، المغادرات، بلاغات الصيانة، والعقود المنتهية",
    descEn: "Operational hub for today's check-ins, check-outs, maintenance, and contracts",
    category: "operations",
    requiredModule: "accommodation",
    requiredAction: "view",
    icon: Layers,
    defaultVisible: true,
  },
  {
    id: "housekeeping_queue",
    labelAr: "طابور أولويات الإشراف الداخلي ونظافة الغرف",
    labelEn: "Housekeeping Priority Queue",
    descAr: "قائمة الغرف المتسخة ذات الأولوية مع سرعة التكليف والتجهيز",
    descEn: "Priority queue of dirty rooms for immediate cleaning and turnover",
    category: "operations",
    requiredModule: "housekeeping",
    requiredAction: "view",
    icon: CheckCircle2,
    defaultVisible: true,
  },
  // Analytics
  {
    id: "donut_analytics",
    labelAr: "مخطط حالات الغرف والأسرة الدائري",
    labelEn: "Room Status & Bed Donut Chart",
    descAr: "رسم بياني دائري لتوزيع حالات الغرف وسعة الأسرة",
    descEn: "Circular distribution of room statuses and bed occupancy",
    category: "analytics",
    requiredModule: "housing",
    requiredAction: "view",
    icon: PieChart,
    defaultVisible: true,
  },
  {
    id: "department_list",
    labelAr: "قائمة إشغال الأقسام الإدارية",
    labelEn: "Department Occupancy Breakdown",
    descAr: "نسب توزيع الموظفين المقيمين حسب الإدارات والأقسام",
    descEn: "Distribution of resident employees per operational department",
    category: "analytics",
    requiredModule: "profiles",
    requiredAction: "view",
    icon: Users,
    defaultVisible: true,
  },
  {
    id: "gender_demographics",
    labelAr: "المؤشرات الديموغرافية والنوعية (ذكور/إناث)",
    labelEn: "Gender & Demographics Card",
    descAr: "توزيع المقيمين بالسكن حسب النوع والنسب المئوية",
    descEn: "Demographic breakdown of male vs. female residents",
    category: "analytics",
    requiredModule: "profiles",
    requiredAction: "view",
    icon: Activity,
    defaultVisible: true,
  },
  {
    id: "building_charts",
    labelAr: "الرسم البياني لإشغال المباني والمسار الزمني",
    labelEn: "Building Occupancy & Trend Charts",
    descAr: "معدلات استيعاب كل مبنى ومسار تطور الإشغال على مدار الأيام",
    descEn: "Bar charts of building utilization and occupancy trajectory over time",
    category: "analytics",
    requiredModule: "housing",
    requiredAction: "view",
    icon: BarChart3,
    defaultVisible: true,
  },
  {
    id: "capacity_matrix",
    labelAr: "مصفوفة استيعاب المباني التفصيلية",
    labelEn: "Building Capacity Matrix",
    descAr: "عرض شبكي معماري لكافة المباني مع أشرطة السعة والاستيعاب",
    descEn: "Detailed visual matrix of all buildings with utilization progress bars",
    category: "analytics",
    requiredModule: "housing",
    requiredAction: "view",
    icon: Building2,
    defaultVisible: true,
  },
];

export function useDashboardWidgets() {
  const { user } = useAuth();
  const { can, isSuperAdmin } = usePermission();

  const storageKey = useMemo(() => {
    return user?.id ? `sunrise_dashboard_widgets_user_${user.id}` : "sunrise_dashboard_widgets_guest";
  }, [user?.id]);

  // Load saved preferences
  const [userPreferences, setUserPreferences] = useState<Record<DashboardWidgetId, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    // Fallback: all default visible
    const initial: Record<string, boolean> = {};
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      initial[w.id] = w.defaultVisible;
    }
    return initial as Record<DashboardWidgetId, boolean>;
  });

  // Reload when storageKey changes (e.g. user switch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setUserPreferences(JSON.parse(saved));
        return;
      }
    } catch {}

    const initial: Record<string, boolean> = {};
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      initial[w.id] = w.defaultVisible;
    }
    setUserPreferences(initial as Record<DashboardWidgetId, boolean>);
  }, [storageKey]);

  // Save to localStorage
  const savePreferences = useCallback(
    (next: Record<DashboardWidgetId, boolean>) => {
      setUserPreferences(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    },
    [storageKey],
  );

  // Toggle single widget
  const toggleWidget = useCallback(
    (id: DashboardWidgetId) => {
      setUserPreferences((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  // Set single widget visibility explicitly
  const setWidgetVisible = useCallback(
    (id: DashboardWidgetId, visible: boolean) => {
      setUserPreferences((prev) => {
        const next = { ...prev, [id]: visible };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  // Reset to default
  const resetToDefault = useCallback(() => {
    const initial: Record<string, boolean> = {};
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      initial[w.id] = w.defaultVisible;
    }
    savePreferences(initial as Record<DashboardWidgetId, boolean>);
  }, [savePreferences]);

  // Enable all allowed
  const enableAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      next[w.id] = true;
    }
    savePreferences(next as Record<DashboardWidgetId, boolean>);
  }, [savePreferences]);

  // Disable all
  const disableAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      next[w.id] = false;
    }
    savePreferences(next as Record<DashboardWidgetId, boolean>);
  }, [savePreferences]);

  // Compute Permission Status for each widget
  const widgetPermissions = useMemo(() => {
    const perms: Record<DashboardWidgetId, boolean> = {} as any;
    for (const w of DASHBOARD_WIDGETS_REGISTRY) {
      if (isSuperAdmin) {
        perms[w.id] = true;
      } else if (!w.requiredModule) {
        perms[w.id] = true;
      } else {
        perms[w.id] = can(w.requiredModule as any, (w.requiredAction as any) || "view");
      }
    }
    return perms;
  }, [can, isSuperAdmin]);

  // Effective visibility: ONLY visible if enabled by user AND user has permission!
  const isWidgetVisible = useCallback(
    (id: DashboardWidgetId): boolean => {
      const allowedByPermission = widgetPermissions[id] ?? false;
      if (!allowedByPermission) return false;
      return userPreferences[id] ?? true;
    },
    [widgetPermissions, userPreferences],
  );

  // Count active/visible widgets
  const visibleCount = useMemo(() => {
    return DASHBOARD_WIDGETS_REGISTRY.filter((w) => isWidgetVisible(w.id)).length;
  }, [isWidgetVisible]);

  const totalAllowedCount = useMemo(() => {
    return DASHBOARD_WIDGETS_REGISTRY.filter((w) => widgetPermissions[w.id]).length;
  }, [widgetPermissions]);

  return {
    registry: DASHBOARD_WIDGETS_REGISTRY,
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
  };
}
