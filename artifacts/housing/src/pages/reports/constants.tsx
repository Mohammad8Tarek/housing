import {
  TrendingUp,
  Building2,
  Users,
  BedDouble,
  Wrench,
  CalendarDays,
  Hotel,
  Clock,
  Home,
  Sparkles,
} from "lucide-react";
import { TabConfig } from "./types";

export const TABS: TabConfig[] = [
  {
    id: "analytics",
    label: "Analytics",
    labelAr: "تحليلات عامة",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: "assignments",
    label: "In-House Occupants",
    labelAr: "المقيمين والتسكين",
    icon: <Users className="w-4 h-4 text-blue-500" />,
  },
  {
    id: "vacant_rooms",
    label: "Vacant Rooms & Beds",
    labelAr: "الغرف والأسرة الشاغرة",
    icon: <BedDouble className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: "housing",
    label: "Room Inventory",
    labelAr: "جرد وحالة الغرف",
    icon: <Building2 className="w-4 h-4 text-sky-500" />,
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
    id: "reservations",
    label: "Arrivals & Reservations",
    labelAr: "الحجوزات والوصول",
    icon: <CalendarDays className="w-4 h-4 text-indigo-500" />,
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
    id: "housekeeping",
    label: "Housekeeping",
    labelAr: "هاوس كيبنج",
    icon: <Sparkles className="w-4 h-4 text-pink-500" />,
  },
];
