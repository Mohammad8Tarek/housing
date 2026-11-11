// Module-level constants/types of PermissionMatrixCenter (moved verbatim).

export interface PermissionMatrixCenterProps {
  users: any[];
  selectedUserId?: number | null;
  onSelectUser?: (userId: number) => void;
  properties?: any[];
}

// 9 Comprehensive System Role Presets
export interface SystemRolePreset {
  value: string;
  labelEn: string;
  labelAr: string;
  badgeClass: string;
}

export const SYSTEM_ROLE_PRESETS: SystemRolePreset[] = [
  {
    value: "super_admin",
    labelEn: "Super Admin",
    labelAr: "مدير النظام العام",
    badgeClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300",
  },
  {
    value: "system_admin",
    labelEn: "System Admin",
    labelAr: "مدير النظام التقني",
    badgeClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300",
  },
  {
    value: "admin",
    labelEn: "Property Admin",
    labelAr: "مدير النظام",
    badgeClass:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300",
  },
  {
    value: "manager",
    labelEn: "Property Manager",
    labelAr: "مدير المجمع",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300",
  },
  {
    value: "receptionist",
    labelEn: "Receptionist",
    labelAr: "موظف استقبال",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300",
  },
  {
    value: "maintenance_staff",
    labelEn: "Maintenance Staff",
    labelAr: "موظف صيانة فنية",
    badgeClass:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300",
  },
  {
    value: "housekeeping_staff",
    labelEn: "Housekeeping Staff",
    labelAr: "موظف خدمات ونظافة",
    badgeClass:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300",
  },
  {
    value: "hr_admin",
    labelEn: "HR Admin",
    labelAr: "مسؤول الموارد البشرية",
    badgeClass:
      "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border-pink-300",
  },
  {
    value: "portal_admin",
    labelEn: "Portal Admin",
    labelAr: "مسؤول البوابة",
    badgeClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300",
  },
  {
    value: "security_staff",
    labelEn: "Security Staff",
    labelAr: "موظف أمن",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300",
  },
];
