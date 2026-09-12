import * as React from "react";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { type Module, type Action } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Zap,
  CalendarPlus,
  UserCheck,
  ArrowRightLeft,
  LogOut,
  Users,
  History,
  BedDouble,
  Building2,
  Sparkles,
  PackageCheck,
  Key,
  UserPlus,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  FileBarChart2,
  CalendarDays,
  ClipboardCheck,
  AlertOctagon,
  CalendarRange,
  ShieldCheck,
  Lock,
  Activity,
  Search,
  ArrowUpRight,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";

export type QuickActionCategory =
  | "all"
  | "accommodation"
  | "housing"
  | "profiles"
  | "maintenance"
  | "reports"
  | "security";

export interface QuickActionItem {
  id: string;
  category: QuickActionCategory;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  path: string;
  module: Module;
  action: Action;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeAr?: string;
  badgeEn?: string;
}

export const QUICK_ACTIONS: QuickActionItem[] = [
  // ── Accommodation & Front Office ──
  {
    id: "new_reservation",
    category: "accommodation",
    titleAr: "معالج حجز وتسكين جديد",
    titleEn: "New Reservation Wizard",
    descAr: "حجز غرف وأسرة مسبقاً للوافدين الجدد مع تحديد المبنى والغرفة والتواريخ",
    descEn: "Advance booking and bed allocation for expected staff and guests",
    path: "/accommodation/reservations",
    module: "reservations",
    action: "create",
    icon: CalendarPlus,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "hover:border-indigo-500/40",
    badgeAr: "حجز فوري",
    badgeEn: "Booking",
  },
  {
    id: "smart_assignment",
    category: "accommodation",
    titleAr: "محرك التسكين الذكي",
    titleEn: "Smart Room Assignment",
    descAr: "مطابقة الموظفين مع أنسب الغرف والأسرة المتاحة حسب القسم والجنس",
    descEn: "Intelligent auto-matching of staff to optimal vacant beds by criteria",
    path: "/accommodation/room-assignment",
    module: "accommodation",
    action: "create",
    icon: UserCheck,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "hover:border-blue-500/40",
    badgeAr: "تسكين ذكي",
    badgeEn: "Smart Match",
  },
  {
    id: "transfer_bed",
    category: "accommodation",
    titleAr: "نقل سرير / غرفة",
    titleEn: "Bed & Room Transfer",
    descAr: "نقل نزيل بين الغرف والأسرة فورياً مع تحديث إشغال المباني تلقائياً",
    descEn: "Seamless intra-housing resident relocation with immediate occupancy updates",
    path: "/accommodation/in-house",
    module: "accommodation",
    action: "transfer",
    icon: ArrowRightLeft,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "hover:border-cyan-500/40",
    badgeAr: "نقل سريع",
    badgeEn: "Relocation",
  },
  {
    id: "express_checkout",
    category: "accommodation",
    titleAr: "تسجيل مغادرة سريع",
    titleEn: "Express Check-Out",
    descAr: "إنهاء إقامة النزيل، استلام المفاتيح، وتحويل الغرفة إلى غير نظيفة للهاوس كيبنج",
    descEn: "Release bed, collect keys, and automatically trigger housekeeping turnover",
    path: "/accommodation/in-house",
    module: "accommodation",
    action: "checkout",
    icon: LogOut,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "hover:border-rose-500/40",
    badgeAr: "إخلاء طرف",
    badgeEn: "Check-out",
  },
  {
    id: "guest_hosting",
    category: "accommodation",
    titleAr: "استضافة وزيارات ضيوف",
    titleEn: "Guest & Visitor Hosting",
    descAr: "إدارة وتسكين طلبات استضافة أقارب الموظفين والزوار الرسميين",
    descEn: "Process employee guest hosting requests and manage visitor stays",
    path: "/accommodation/guest-hosting",
    module: "guest_hosting",
    action: "create",
    icon: Users,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "hover:border-teal-500/40",
    badgeAr: "استضافات",
    badgeEn: "Guest Host",
  },
  {
    id: "history_archive",
    category: "accommodation",
    titleAr: "سجل التسكين التاريخي",
    titleEn: "Accommodation Archive",
    descAr: "سجل الإقامات السابقة وحركات النقل والمغادرة مع فلاتر التصدير",
    descEn: "Historical stay records, departures archive, and audit export logs",
    path: "/accommodation/history",
    module: "accommodation",
    action: "view",
    icon: History,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "hover:border-slate-500/40",
  },

  // ── Housing & Rooms ──
  {
    id: "add_room",
    category: "housing",
    titleAr: "إضافة غرفة جديدة",
    titleEn: "Add New Room",
    descAr: "تعريف رقم غرفة جديد وتحديد سعة الأسرة والدور والمبنى ونوع التسكين",
    descEn: "Register a new room with bed capacity, floor, building, and gender rules",
    path: "/housing",
    module: "housing",
    action: "create",
    icon: BedDouble,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "hover:border-emerald-500/40",
    badgeAr: "إدارة الغرف",
    badgeEn: "Rooms",
  },
  {
    id: "add_building",
    category: "housing",
    titleAr: "إضافة مبنى سكني",
    titleEn: "Add Residential Building",
    descAr: "إنشاء منشأة أو مبنى سكني جديد وتحديد عدد الطوابق والسعة الاستيعابية",
    descEn: "Set up a new residential block with floor configurations and total capacity",
    path: "/housing",
    module: "housing",
    action: "create",
    icon: Building2,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "hover:border-sky-500/40",
  },
  {
    id: "housekeeping_clean",
    category: "housing",
    titleAr: "تجهيز واعتماد نظافة الغرف",
    titleEn: "Housekeeping Turnover",
    descAr: "تحديث الغرف المتسخة وتحويلها إلى جاهزة ونظيفة للتسكين الفوري",
    descEn: "Review dirty rooms queue and update turnover status to clean/inspected",
    path: "/housing",
    module: "housing",
    action: "edit",
    icon: Sparkles,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40",
    badgeAr: "هاوس كيبنج",
    badgeEn: "Housekeeping",
  },
  {
    id: "amenities_inventory",
    category: "housing",
    titleAr: "جرد عهد ومحتويات الغرف",
    titleEn: "Amenities & Assets Inventory",
    descAr: "متابعة سلامة أثاث ومكيفات وأجهزة الغرف وباركود كل عهدة",
    descEn: "Track appliances, furniture, and barcode inventory condition per room",
    path: "/reports",
    module: "housing",
    action: "view",
    icon: PackageCheck,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "hover:border-teal-500/40",
  },
  {
    id: "smart_locks_hotek",
    category: "housing",
    titleAr: "برمجة أقفال هوتك الذكية",
    titleEn: "Hotek Smart Lock Cards",
    descAr: "إصدار وتشفير كروت RFID الإلكترونية لمداخل الغرف والمباني",
    descEn: "Encode and manage Hotek RFID electronic key cards for room access",
    path: "/settings",
    module: "smart_locks",
    action: "view",
    icon: Key,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "hover:border-violet-500/40",
    badgeAr: "أقفال RFID",
    badgeEn: "Hotek",
  },

  // ── Profiles & HR ──
  {
    id: "create_profile",
    category: "profiles",
    titleAr: "إضافة ملف موظف جديد",
    titleEn: "Add Employee Profile",
    descAr: "تسجيل موظف بالرقم القومي، الوظيفة، القسم، ورقم الهاتف وتاريخ الميلاد",
    descEn: "Create new employee profile with national ID, job role, and department",
    path: "/profiles",
    module: "profiles",
    action: "create",
    icon: UserPlus,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "hover:border-blue-500/40",
    badgeAr: "دليل الموظفين",
    badgeEn: "HR Staff",
  },
  {
    id: "excel_import_staff",
    category: "profiles",
    titleAr: "استيراد كشف موظفين Excel",
    titleEn: "Bulk Excel Staff Import",
    descAr: "رفع كشوفات الموظفين مجمعة من ملفات Excel وتحديث البيانات آلياً",
    descEn: "Upload multi-employee Excel sheets with automated schema mapping",
    path: "/profiles",
    module: "profiles",
    action: "create",
    icon: FileSpreadsheet,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "hover:border-emerald-500/40",
    badgeAr: "استيراد Excel",
    badgeEn: "Batch",
  },
  {
    id: "expiring_contracts",
    category: "profiles",
    titleAr: "متابعة العقود المنتهية",
    titleEn: "Expiring Contracts Audit",
    descAr: "حصر عقود العمل وفترات الإقامة القريبة من الانتهاء (خلال 30 يوماً)",
    descEn: "Monitor employment agreements and accommodations expiring within 30 days",
    path: "/reports",
    module: "profiles",
    action: "view",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40",
  },

  // ── Maintenance & Engineering ──
  {
    id: "urgent_maintenance",
    category: "maintenance",
    titleAr: "فتح بلاغ صيانة عاجل",
    titleEn: "Create Urgent Work Order",
    descAr: "تسجيل عطل فني في غرفة أو مرفق وتحديد درجة الأولوية والفني المسؤول",
    descEn: "Log maintenance fault ticket with urgency level, room, and technician",
    path: "/maintenance",
    module: "maintenance",
    action: "create",
    icon: AlertTriangle,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "hover:border-orange-500/40",
    badgeAr: "صيانة عاجلة",
    badgeEn: "Urgent",
  },
  {
    id: "assign_work_order",
    category: "maintenance",
    titleAr: "إسناد ومتابعة تذاكر الصيانة",
    titleEn: "Assign Work Orders",
    descAr: "توزيع مهام السباكة والكهرباء والتكييف ومتابعة زمن الإنجاز",
    descEn: "Dispatch tickets to maintenance crew and track resolution SLAs",
    path: "/maintenance",
    module: "maintenance",
    action: "assign",
    icon: Wrench,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40",
  },
  {
    id: "ooo_audit",
    category: "maintenance",
    titleAr: "حصر الغرف الخارجة عن الخدمة",
    titleEn: "Out of Order (OOO) Audit",
    descAr: "مراجعة الغرف المغلقة للصيانة الشاملة وتواريخ جاهزيتها للعودة للخدمة",
    descEn: "Audit out-of-order and out-of-service rooms with expected ready dates",
    path: "/reports",
    module: "maintenance",
    action: "view",
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "hover:border-red-500/40",
  },

  // ── Executive Reports & Hospitality Audits ──
  {
    id: "morning_flash_report",
    category: "reports",
    titleAr: "التقرير الصباحي الشامل للإشغال",
    titleEn: "Daily Morning Operations Report",
    descAr: "تقرير المدير الصباحي التنفيذي، مؤشرات اليوم، طاقة المباني، والتوقيعات",
    descEn: "Executive daily morning report, occupancy KPIs, and movements matrix",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: FileBarChart2,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "hover:border-amber-500/40",
    badgeAr: "تقرير المدير",
    badgeEn: "Executive",
  },
  {
    id: "arrivals_manifest_report",
    category: "reports",
    titleAr: "كشف المتوقع وصولهم اليوم",
    titleEn: "Expected Arrivals Manifest",
    descAr: "كشف تشغيلي بالوافدين المؤكدين مع الغرف والأسرة المخصصة وتصنيف VIP",
    descEn: "Operational manifest of due-in residents with room allocations and VIP status",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: CalendarDays,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "hover:border-emerald-500/40",
    badgeAr: "وصول اليوم",
    badgeEn: "Due In",
  },
  {
    id: "departures_manifest_report",
    category: "reports",
    titleAr: "كشف المغادرات والتصفيات",
    titleEn: "Due Out & Departures Manifest",
    descAr: "حصر المغادرات المستحقة وتصفيات الموارد البشرية لتجهيز الغرف فوراً",
    descEn: "Track scheduled departures and HR clearances for immediate key handover",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: LogOut,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "hover:border-rose-500/40",
    badgeAr: "مغادرة اليوم",
    badgeEn: "Due Out",
  },
  {
    id: "housekeeping_sheet_report",
    category: "reports",
    titleAr: "كشف مهام الهاوس كيبنج الميداني",
    titleEn: "Attendant Task Sheet",
    descAr: "كشف توزيع مهام النظافة الميداني بأولويات 1 و 2 و 3 مع خانات الفحص الورقي",
    descEn: "Daily task sheet formatted for clipboards with linen, amenity, and signature checks",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: ClipboardCheck,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "hover:border-sky-500/40",
    badgeAr: "كشف ميداني",
    badgeEn: "Task Sheet",
  },
  {
    id: "room_discrepancy_report",
    category: "reports",
    titleAr: "مركز تدقيق ومطابقة الغرف",
    titleEn: "Room Status Discrepancy & Audit",
    descAr: "اكتشاف تباينات النوم (Sleep) والمغادرة غير المسجلة (Skip) وتكدس الغرف",
    descEn: "Flags discrepancies between front desk records and physical room status",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: AlertOctagon,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "hover:border-red-500/40",
    badgeAr: "تدقيق تباين",
    badgeEn: "Audit Hub",
  },
  {
    id: "occupancy_forecast_report",
    category: "reports",
    titleAr: "توقعات الإشغال (7 / 14 / 30 يوماً)",
    titleEn: "Occupancy Forecast Engine",
    descAr: "توقعات يومية لحركة النزلاء والقادمين والمغادرين وصافي حركة الأسرة المتاحة",
    descEn: "Multi-horizon projected occupancy, expected turnover, and net capacity shifts",
    path: "/reports",
    module: "reports",
    action: "view",
    icon: CalendarRange,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "hover:border-violet-500/40",
    badgeAr: "توقعات مستقبلية",
    badgeEn: "Forecast",
  },

  // ── Administration & Security ──
  {
    id: "add_system_user",
    category: "security",
    titleAr: "إضافة مستخدم جديد للنظام",
    titleEn: "Add System User",
    descAr: "إنشاء حساب مستخدم وتحديد الفنادق المصرح له بإدارتها ورتبته في النظام",
    descEn: "Register staff admin account and assign permitted property schemas",
    path: "/users",
    module: "users",
    action: "create",
    icon: ShieldCheck,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "hover:border-indigo-500/40",
    badgeAr: "إدارة الحسابات",
    badgeEn: "Users",
  },
  {
    id: "permission_matrix_hub",
    category: "security",
    titleAr: "مصفوفة الصلاحيات وحوكمة RBAC",
    titleEn: "RBAC Permission Matrix",
    descAr: "ضبط الصلاحيات المتقدمة الثنائية لكل وحدة وعملية في النظام",
    descEn: "Fine-grained dual-layer permission matrix for roles and custom accounts",
    path: "/users",
    module: "users",
    action: "manage_permissions",
    icon: Lock,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "hover:border-purple-500/40",
    badgeAr: "صلاحيات RBAC",
    badgeEn: "Matrix",
  },
  {
    id: "audit_activity_log",
    category: "security",
    titleAr: "سجل الرقابة ونشاط العمليات",
    titleEn: "Audit Trail & Activity Log",
    descAr: "استعراض سجل الحركات الأمنية والإدارية والتعديلات المنفذة في النظام لحظياً",
    descEn: "Real-time audit log of user logins, data modifications, and security actions",
    path: "/activity-log",
    module: "activity_log",
    action: "view",
    icon: Activity,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "hover:border-slate-500/40",
  },
];

interface QuickAssistTabProps {
  buildNavHref: (path: string) => string;
}

export function QuickAssistTab({ buildNavHref }: QuickAssistTabProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { can, isSuperAdmin } = usePermission();

  const [selectedCategory, setSelectedCategory] = React.useState<QuickActionCategory>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [onlyPermitted, setOnlyPermitted] = React.useState(true);

  // Categories config
  const categories: Array<{ id: QuickActionCategory; labelAr: string; labelEn: string }> = [
    { id: "all", labelAr: "كافة الإجراءات", labelEn: "All Actions" },
    { id: "accommodation", labelAr: "التسكين والاستقبال", labelEn: "Accommodation" },
    { id: "housing", labelAr: "الغرف ومرافق السكن", labelEn: "Housing & Rooms" },
    { id: "profiles", labelAr: "شؤون الموظفين", labelEn: "HR & Profiles" },
    { id: "maintenance", labelAr: "الصيانة والتشغيل", labelEn: "Maintenance" },
    { id: "reports", labelAr: "التقارير التنفيذية", labelEn: "Executive Reports" },
    { id: "security", labelAr: "الإدارة والأمان", labelEn: "System & Security" },
  ];

  // Evaluate permission for an action item
  const checkActionPermission = React.useCallback(
    (item: QuickActionItem): boolean => {
      if (isSuperAdmin) return true;
      return can(item.module, item.action);
    },
    [can, isSuperAdmin],
  );

  // Filtered action list
  const filteredActions = React.useMemo(() => {
    return QUICK_ACTIONS.filter((item) => {
      const hasPerm = checkActionPermission(item);

      // Filter by permitted toggle
      if (onlyPermitted && !hasPerm) return false;

      // Filter by category
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAr = item.titleAr.toLowerCase().includes(q) || item.descAr.toLowerCase().includes(q);
        const matchesEn = item.titleEn.toLowerCase().includes(q) || item.descEn.toLowerCase().includes(q);
        const matchesCode = `${item.module}.${item.action}`.toLowerCase().includes(q);
        if (!matchesAr && !matchesEn && !matchesCode) return false;
      }

      return true;
    });
  }, [selectedCategory, searchQuery, onlyPermitted, checkActionPermission]);

  // Total permitted count
  const totalPermittedCount = React.useMemo(() => {
    return QUICK_ACTIONS.filter(checkActionPermission).length;
  }, [checkActionPermission]);

  return (
    <div className="space-y-4">
      {/* Top Controls: Search, Permitted Counter, and Filter Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/40">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              ar
                ? "بحث فوري في الإجراءات السريعة (مثال: حجز، نقل، صيانة، تقرير)..."
                : "Search quick actions (e.g. Booking, Transfer, Ticket, Report)..."
            }
            className="h-8 text-xs pl-8 rtl:pl-3 rtl:pr-8 bg-background/80"
          />
        </div>

        {/* Permission Badge & Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[11px] gap-1.5 py-1 px-2.5 border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 font-semibold"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {ar
                ? `${totalPermittedCount} إجراء مصرح لصلاحياتك`
                : `${totalPermittedCount} actions permitted for your role`}
            </span>
          </Badge>

          <button
            type="button"
            onClick={() => setOnlyPermitted(!onlyPermitted)}
            className={cn(
              "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 cursor-pointer",
              onlyPermitted
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border hover:text-foreground",
            )}
            title={ar ? "تبديل إظهار كل الإجراءات أو المصرحة لك فقط" : "Toggle only permitted actions"}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{ar ? "صلاحياتي فقط" : "My Permissions Only"}</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const countInCat = QUICK_ACTIONS.filter(
            (item) => (cat.id === "all" || item.category === cat.id) && checkActionPermission(item),
          ).length;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <span>{ar ? cat.labelAr : cat.labelEn}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                  isSelected ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {countInCat}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions Grid */}
      {filteredActions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
          {filteredActions.map((item) => {
            const hasPerm = checkActionPermission(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={hasPerm ? buildNavHref(item.path) : "#"}
                className={cn(
                  "group relative p-3.5 rounded-xl border border-border/60 bg-card/60 transition-all duration-200 flex flex-col justify-between gap-2.5 select-none",
                  hasPerm
                    ? `${item.borderColor} hover:bg-muted/50 hover:shadow-md cursor-pointer hover:-translate-y-0.5`
                    : "opacity-50 grayscale cursor-not-allowed bg-muted/20 border-dashed",
                )}
              >
                {/* Header: Icon + Title + Perm Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        item.bgColor,
                        item.color,
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {ar ? item.titleAr : item.titleEn}
                      </h4>
                      <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                        {item.module}.{item.action}
                      </p>
                    </div>
                  </div>

                  {/* Status / Category Badge */}
                  <div className="shrink-0 flex items-center gap-1">
                    {item.badgeAr && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                        {ar ? item.badgeAr : item.badgeEn}
                      </span>
                    )}
                    {hasPerm ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/70" />
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {ar ? item.descAr : item.descEn}
                </p>

                {/* Bottom Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px]">
                  <span className="text-muted-foreground font-medium">
                    {hasPerm ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {ar ? "متاح للتنفيذ" : "Authorized"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        {ar ? "يتطلب صلاحية" : "Restricted"}
                      </span>
                    )}
                  </span>

                  <span className="font-semibold text-primary/80 group-hover:text-primary transition-colors">
                    {ar ? "فتح الإجراء ←" : "Execute →"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2 bg-muted/20 rounded-xl border border-dashed border-border">
          <Zap className="w-8 h-8 text-muted-foreground/40" />
          <h4 className="text-sm font-semibold text-foreground">
            {ar ? "لا توجد إجراءات تطابق البحث أو الصلاحيات" : "No actions match your search or permissions"}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            {ar
              ? "جرّب إلغاء تفعيل فلتر 'صلاحياتي فقط' أو كتابة مصطلح بحث مختلف"
              : "Try toggling off 'My Permissions Only' or clearing the search box"}
          </p>
        </div>
      )}
    </div>
  );
}
