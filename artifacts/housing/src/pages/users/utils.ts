export const SYSTEM_ROLES = [
  { value: "super_admin", label: "Super Admin", labelAr: "مدير النظام العام" },
  { value: "admin", label: "System Admin", labelAr: "مدير النظام" },
  { value: "manager", label: "Property Manager", labelAr: "مدير المجمع" },
  { value: "receptionist", label: "Receptionist", labelAr: "موظف استقبال" },
  { value: "maintenance_staff", label: "Tickets Staff", labelAr: "موظف صيانة" },
];

export const WORKFLOW_ROLES = [
  {
    value: "none",
    label: "None / Not a Manager",
    labelAr: "لا يوجد / ليس مدير",
  },
  {
    value: "department_manager",
    label: "Department Manager",
    labelAr: "مدير القسم",
  },
  { value: "housing_manager", label: "Housing Manager", labelAr: "مدير السكن" },
  { value: "hr_manager", label: "HR Manager", labelAr: "مدير الموارد البشرية" },
  {
    value: "accounts_manager",
    label: "Accounts Manager",
    labelAr: "مدير الحسابات",
  },
  {
    value: "hotel_gm",
    label: "Hotel General Manager",
    labelAr: "المدير العام للفندق",
  },
  {
    value: "hotel_fc",
    label: "Hotel Financial Controller",
    labelAr: "المراقب المالي للفندق",
  },
];

export const roleColor = (role: string) => {
  switch (role.toLowerCase()) {
    case "super_admin":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "manager":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "housing_manager":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
    case "hr_manager":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300";
    case "accounts_manager":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "receptionist":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "maintenance_staff":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
};
