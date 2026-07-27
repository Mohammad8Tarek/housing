import {
  TrendingUp,
  Home,
  Users,
  BookOpen,
  Wrench,
  BarChart2,
} from "lucide-react";
import { TabConfig } from "./types";

export const TABS: TabConfig[] = [
  {
    id: "analytics",
    label: "Analytics",
    labelAr: "تحليلات",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: "housing",
    label: "Housing",
    labelAr: "الغرف",
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: "employees",
    label: "Employees",
    labelAr: "الموظفون",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "assignments",
    label: "Assignments",
    labelAr: "الإسكان",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: "hostings",
    label: "Guests",
    labelAr: "الضيوف",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    labelAr: "الصيانة",
    icon: <Wrench className="w-4 h-4" />,
  },
  {
    id: "reservations",
    label: "Reservations",
    labelAr: "الحجوزات",
    icon: <BarChart2 className="w-4 h-4" />,
  },
];
