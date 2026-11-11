import {
  TrendingUp,
  Building2,
  Users,
  BedDouble,
  Wrench,
  Hotel,
  Clock,
  Home,
  PackageCheck,
  FileBarChart2,
  UserCheck,
  LogOut,
  ClipboardCheck,
  AlertOctagon,
  CalendarRange,
  ArrowLeftRight,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  Star,
  Droplets,
  Scale,
  Palmtree,
  HeartHandshake,
} from "lucide-react";
import { Tab, TabConfig } from "./types";

export const TABS: TabConfig[] = [
  {
    id: "manager_flash",
    label: "Morning Operations Report",
    labelAr: "التقرير الصباحي الشامل",
    icon: <FileBarChart2 className="w-4 h-4 text-amber-500" />,
  },
  {
    id: "arrivals_manifest",
    label: "Reservations & Arrivals",
    labelAr: "الحجوزات والمتوقع وصولهم",
    icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: "departures_manifest",
    label: "Due Out & Departures",
    labelAr: "كشف المغادرات والتصفيات",
    icon: <LogOut className="w-4 h-4 text-rose-500" />,
  },
  {
    id: "housekeeping_sheet",
    label: "Housekeeping & Cleanliness",
    labelAr: "كشف مهام ونظافة الغرف",
    icon: <ClipboardCheck className="w-4 h-4 text-sky-500" />,
  },
  {
    id: "room_discrepancy",
    label: "Room Discrepancy & Audit",
    labelAr: "تدقيق ومطابقة الغرف",
    icon: <AlertOctagon className="w-4 h-4 text-red-500" />,
  },
  {
    id: "occupancy_forecast",
    label: "Occupancy Forecast",
    labelAr: "توقعات الإشغال المستقبلية",
    icon: <CalendarRange className="w-4 h-4 text-violet-500" />,
  },
  {
    id: "analytics",
    label: "Analytics",
    labelAr: "تحليلات عامة",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: "assignments",
    label: "In-House Occupants & Rooms",
    labelAr: "المقيمين والتسكين (بالغرف والنزلاء)",
    icon: <Users className="w-4 h-4 text-blue-500" />,
  },
  {
    id: "vacant_rooms",
    label: "Vacant Beds & Operational Capacity",
    labelAr: "مصفوفة السعة والأسرة الشاغرة",
    icon: <BedDouble className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: "housing",
    label: "Complete Room Inventory",
    labelAr: "سجل وحالة كافة الغرف",
    icon: <Building2 className="w-4 h-4 text-sky-500" />,
  },
  {
    id: "daily_movement",
    label: "Daily Movement",
    labelAr: "الحركة اليومية",
    icon: <ArrowLeftRight className="w-4 h-4 text-blue-600" />,
  },
  {
    id: "department_occupancy",
    label: "Department Occupancy",
    labelAr: "إشغال الأقسام",
    icon: <Briefcase className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: "gate_logs",
    label: "Gate Security Logs",
    labelAr: "سجل البوابة والأمن",
    icon: <ShieldCheck className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: "police_report",
    label: "Tourism Police Manifest",
    labelAr: "كشف شرطة ووزارة السياحة",
    icon: <ShieldAlert className="w-4 h-4 text-blue-700" />,
  },
  {
    id: "equipment_inventory",
    label: "Amenities & Equipment Inventory",
    labelAr: "جرد المحتويات والمعدات",
    icon: <PackageCheck className="w-4 h-4 text-cyan-500" />,
  },
  {
    id: "profiles",
    label: "Profiles Directory",
    labelAr: "دليل البروفايلات",
    icon: <Hotel className="w-4 h-4 text-purple-500" />,
  },
  {
    id: "expiring_contracts",
    label: "Contract Expirations",
    labelAr: "انتهاء العقود",
    icon: <Clock className="w-4 h-4 text-amber-500" />,
  },
  {
    id: "hostings",
    label: "Guest Hostings",
    labelAr: "الاستضافات والزوار",
    icon: <Home className="w-4 h-4 text-teal-500" />,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    labelAr: "طلبات الصيانة",
    icon: <Wrench className="w-4 h-4 text-rose-500" />,
  },
  {
    id: "service_ratings",
    label: "Service Quality & Ratings",
    labelAr: "تقييمات جودة الصيانة والنظافة",
    icon: <Star className="w-4 h-4 text-amber-500" />,
  },
  {
    id: "housing_map",
    label: "Housing Map & Structure",
    labelAr: "خريطة وتفصيل السكن والمباني",
    icon: <Building2 className="w-4 h-4 text-indigo-500" />,
  },
  {
    id: "water_distribution",
    label: "Water Distribution Sheet",
    labelAr: "كشف صرف مياه الشرب الشهري",
    icon: <Droplets className="w-4 h-4 text-cyan-500" />,
  },
  {
    id: "vacations",
    label: "Vacations",
    labelAr: "الإجازات",
    icon: <Palmtree className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: "policy_exceptions",
    label: "Policy Exceptions & Level Audit",
    labelAr: "تقرير استثناءات ومخالفات السياسة",
    icon: <Scale className="w-4 h-4 text-rose-600" />,
  },
  {
    id: "housing_ratings",
    label: "Weekly Housing Pulse",
    labelAr: "استطلاع جودة السكن الأسبوعي",
    icon: <HeartHandshake className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: "room_moves",
    label: "Room Moves & Bed Transfers",
    labelAr: "حركات نقل وتغيير الغرف (Room Moves)",
    icon: <ArrowLeftRight className="w-4 h-4 text-indigo-500" />,
  },
];

/** Report catalog groups — the 26 reports organised by business area for navigation. */
export interface ReportGroup {
  id: string;
  label: string;
  labelAr: string;
  tabs: Tab[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "operations",
    label: "Daily Operations",
    labelAr: "التشغيل اليومي",
    tabs: [
      "manager_flash",
      "arrivals_manifest",
      "departures_manifest",
      "daily_movement",
      "housekeeping_sheet",
      "room_discrepancy",
      "room_moves",
    ],
  },
  {
    id: "occupancy",
    label: "Occupancy & Rooms",
    labelAr: "الإشغال والغرف",
    tabs: [
      "assignments",
      "vacant_rooms",
      "housing",
      "occupancy_forecast",
      "department_occupancy",
      "housing_map",
    ],
  },
  {
    id: "people",
    label: "Residents & HR",
    labelAr: "المقيمون والموارد البشرية",
    tabs: ["profiles", "expiring_contracts", "vacations", "hostings"],
  },
  {
    id: "compliance",
    label: "Security & Compliance",
    labelAr: "الأمن والامتثال",
    tabs: ["gate_logs", "police_report", "policy_exceptions"],
  },
  {
    id: "services",
    label: "Services & Assets",
    labelAr: "الخدمات والعهد",
    tabs: ["maintenance", "equipment_inventory", "water_distribution"],
  },
  {
    id: "quality",
    label: "Quality & Analytics",
    labelAr: "الجودة والتحليلات",
    tabs: ["analytics", "service_ratings", "housing_ratings"],
  },
];

export const groupOfTab = (tab: Tab): ReportGroup =>
  REPORT_GROUPS.find((g) => g.tabs.includes(tab)) ?? REPORT_GROUPS[0];
