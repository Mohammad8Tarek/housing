// @ts-nocheck

export const MODULES = [
  "dashboard",
  "housing",
  "housekeeping",
  "profiles",
  "accommodation",
  "reservations",
  "maintenance",
  "reports",
  "users",
  "settings",
  "activity_log",
  "properties",
  "documents",
  "billing",
  "communications",
  "evaluations",
  "surveys",
  "portal_content",
  "activities",
  "smart_locks",
  "hosting_requests",
] as const;

export type Module = (typeof MODULES)[number];

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "bulk_delete"
  | "bulk_export"
  | "assign"
  | "checkin"
  | "checkout"
  | "approve"
  | "transfer"
  | "reset_password"
  | "manage_permissions"
  | "view_sensitive"
  | "audit"
  | "publish"
  | "archive"
  | "unlock";

export const ACTIONS: Action[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "bulk_delete",
  "bulk_export",
  "assign",
  "checkin",
  "checkout",
  "approve",
  "transfer",
  "reset_password",
  "manage_permissions",
  "view_sensitive",
  "audit",
  "publish",
  "archive",
  "unlock",
];

export const MODULE_ACTIONS: Record<Module, Action[]> = {
  dashboard: ["view", "export"],
  housing: ["view", "create", "edit", "delete", "export", "bulk_export"],
  housekeeping: ["view", "edit", "assign", "approve", "bulk_export"],
  profiles: [
    "view",
    "create",
    "edit",
    "delete",
    "export",
    "reset_password",
    "manage_permissions",
    "view_sensitive",
  ],
  accommodation: [
    "view",
    "create",
    "edit",
    "assign",
    "checkin",
    "checkout",
    "approve",
    "transfer",
    "bulk_delete",
    "bulk_export",
    "archive",
  ],
  reservations: [
    "view",
    "create",
    "edit",
    "checkin",
    "checkout",
    "approve",
    "bulk_export",
    "archive",
  ],
  maintenance: [
    "view",
    "create",
    "edit",
    "assign",
    "approve",
    "bulk_export",
    "archive",
  ],
  reports: ["view", "export", "audit"],
  users: [
    "view",
    "create",
    "edit",
    "delete",
    "manage_permissions",
    "reset_password",
    "unlock",
  ],
  settings: ["view", "edit", "create", "delete"],
  activity_log: ["view", "export", "audit"],
  properties: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "edit", "delete", "publish", "archive"],
  billing: ["view", "export"],
  communications: ["view", "create"],
  evaluations: ["view", "create", "edit", "delete", "export"],
  surveys: ["view", "create", "edit", "delete"],
  portal_content: ["view", "create", "edit", "delete"],
  activities: ["view", "create", "edit", "delete", "publish"],
  smart_locks: ["view", "create", "edit", "delete"],
  hosting_requests: ["view", "create", "edit", "delete", "approve"],
};

export const moduleActions = (module: Module): Action[] =>
  MODULE_ACTIONS[module] ?? [];

export const permKey = (module: Module, action: Action) =>
  `${module}.${action}`;

export const getPermissionsForRoles = (
  roles: Array<string | undefined | null>,
): string[] => {
  const normalized = (roles ?? [])
    .map((role) =>
      String(role ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  const merged = new Set<string>();
  for (const role of normalized) {
    for (const permission of ROLE_DEFAULT_PERMISSIONS[role] ?? []) {
      merged.add(permission);
    }
  }

  return Array.from(merged);
};

export const allModulePerms = (module: Module): string[] =>
  (MODULE_ACTIONS[module] ?? []).map((action) => permKey(module, action));

const crudPerms = (module: Module): string[] =>
  (["view", "create", "edit", "delete"] as Action[])
    .filter((action) => (MODULE_ACTIONS[module] ?? []).includes(action))
    .map((action) => permKey(module, action));

const readExportPerms = (module: Module): string[] =>
  (["view", "export"] as Action[])
    .filter((action) => (MODULE_ACTIONS[module] ?? []).includes(action))
    .map((action) => permKey(module, action));

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: MODULES.flatMap((module) => allModulePerms(module)),
  system_admin: MODULES.flatMap((module) => allModulePerms(module)),
  admin: MODULES.filter((module) => module !== "properties").flatMap((module) =>
    allModulePerms(module),
  ),
  manager: [
    // Dashboard
    "dashboard.view",
    "dashboard.export",
    // Housing
    ...crudPerms("housing"),
    "housing.bulk_export",
    // Housekeeping
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.assign",
    "housekeeping.approve",
    "housekeeping.bulk_export",
    // Profiles
    ...crudPerms("profiles"),
    "profiles.export",
    // Accommodation
    ...crudPerms("accommodation"),
    "accommodation.assign",
    "accommodation.checkin",
    "accommodation.checkout",
    "accommodation.approve",
    "accommodation.transfer",
    "accommodation.bulk_delete",
    "accommodation.bulk_export",
    "accommodation.archive",
    // Reservations
    ...crudPerms("reservations"),
    "reservations.checkin",
    "reservations.checkout",
    "reservations.bulk_export",
    "reservations.archive",
    // Hosting Requests
    ...crudPerms("hosting_requests"),
    // Maintenance
    ...crudPerms("maintenance"),
    "maintenance.assign",
    "maintenance.approve",
    "maintenance.bulk_export",
    "maintenance.archive",
    // Reports
    ...readExportPerms("reports"),
    "reports.audit",
    // Users
    "users.view",
    "users.edit",
    "users.manage_permissions",
    "users.unlock",
    // Settings
    "settings.view",
    "settings.edit",
    // Activity Log
    "activity_log.view",
    "activity_log.export",
    "activity_log.audit",
    // Documents
    ...crudPerms("documents"),
    "documents.publish",
    "documents.archive",
    // Billing
    "billing.view",
    "billing.export",
    // Communications
    "communications.view",
    "communications.create",
  ],
  receptionist: [
    "dashboard.view",
    "housing.view",
    "housing.export",
    "housekeeping.view",
    "profiles.view",
    "accommodation.view",
    "accommodation.create",
    "accommodation.edit",
    "accommodation.assign",
    "accommodation.checkin",
    "accommodation.checkout",
    "accommodation.approve",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.checkin",
    "reservations.checkout",
    "reservations.approve",
    "hosting_requests.view",
    "hosting_requests.create",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "reports.view",
    "reports.export",
    "activity_log.view",
    "documents.view",
    "communications.view",
    "communications.create",
  ],
  maintenance_staff: [
    "dashboard.view",
    "housing.view",
    "housekeeping.view",
    "housekeeping.edit",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "maintenance.assign",
    "maintenance.approve",
    "profiles.view",
    "activity_log.view",
    "documents.view",
  ],
  hr_admin: [
    "dashboard.view",
    "dashboard.export",
    ...crudPerms("profiles"),
    "profiles.export",
    ...crudPerms("evaluations"),
    "evaluations.export",
    ...crudPerms("surveys"),
    ...crudPerms("activities"),
    "activities.publish",
    ...crudPerms("documents"),
    ...crudPerms("portal_content"),
    ...crudPerms("communications"),
    "reports.view",
    "reports.export",
    ...crudPerms("hosting_requests"),
  ],
  portal_admin: [
    "dashboard.view",
    ...crudPerms("activities"),
    "activities.publish",
    ...crudPerms("documents"),
    ...crudPerms("portal_content"),
    ...crudPerms("communications"),
    "reports.view",
  ],
  security_staff: [
    "dashboard.view",
    "housing.view",
    "accommodation.view",
    ...crudPerms("smart_locks"),
    "activities.view",
  ],
};

export const MODULE_LABELS: Record<Module, { en: string; ar: string }> = {
  dashboard: { en: "Dashboard", ar: "لوحة القيادة" },
  housing: { en: "Housing", ar: "الإسكان" },
  housekeeping: { en: "Housekeeping", ar: "النظافة" },
  profiles: { en: "Profiles", ar: "الموظفين" },
  accommodation: { en: "Accommodation", ar: "الإقامة" },
  reservations: { en: "Reservations", ar: "الحجوزات" },
  maintenance: { en: "Tickets", ar: "التذاكر" },
  reports: { en: "Reports", ar: "التقارير" },
  users: { en: "Users", ar: "المستخدمين" },
  settings: { en: "Settings", ar: "الإعدادات" },
  activity_log: { en: "Activity Log", ar: "سجل النشاط" },
  properties: { en: "Properties", ar: "الفروع" },
  documents: { en: "Documents", ar: "المستندات" },
  billing: { en: "Billing", ar: "الفواتير" },
  communications: { en: "Communications", ar: "الاتصالات" },
  evaluations: { en: "Evaluations", ar: "التقييمات" },
  surveys: { en: "Surveys", ar: "الاستبيانات" },
  portal_content: { en: "Portal Content", ar: "محتوى البوابة" },
  activities: { en: "Activities", ar: "الأنشطة" },
  smart_locks: { en: "Smart Locks", ar: "الأقفال الذكية" },
  hosting_requests: { en: "Hosting Requests", ar: "طلبات الاستضافة" },
};

export const ACTION_LABELS: Record<Action, { en: string; ar: string }> = {
  view: { en: "View", ar: "عرض" },
  create: { en: "Create", ar: "إضافة" },
  edit: { en: "Edit", ar: "تعديل" },
  delete: { en: "Delete", ar: "حذف" },
  export: { en: "Export", ar: "تصدير" },
  bulk_delete: { en: "Bulk Delete", ar: "حذف جماعي" },
  bulk_export: { en: "Bulk Export", ar: "تصدير جماعي" },
  assign: { en: "Assign", ar: "تعيين" },
  checkin: { en: "Check-in", ar: "تسجيل وصول" },
  checkout: { en: "Check-out", ar: "تسجيل مغادرة" },
  approve: { en: "Approve", ar: "موافقة" },
  transfer: { en: "Transfer", ar: "نقل" },
  reset_password: { en: "Reset Password", ar: "إعادة كلمة المرور" },
  manage_permissions: { en: "Manage Permissions", ar: "إدارة الصلاحيات" },
  view_sensitive: { en: "View Sensitive", ar: "عرض بيانات حساسة" },
  audit: { en: "Audit", ar: "تدقيق" },
  publish: { en: "Publish", ar: "نشر" },
  archive: { en: "Archive", ar: "أرشفة" },
  unlock: { en: "Unlock", ar: "فتح القفل" },
};

export const PERMISSION_GROUPS: Array<{
  id: string;
  label: { en: string; ar: string };
  description: { en: string; ar: string };
  modules: Module[];
}> = [
  {
    id: "daily_operations",
    label: { en: "Daily Operations", ar: "التشغيل اليومي" },
    description: {
      en: "Dashboard, housing setup, rooms, housekeeping, and maintenance.",
      ar: "لوحة المتابعة والسكن والغرف والنظافة والصيانة.",
    },
    modules: ["dashboard", "housing", "housekeeping", "maintenance"],
  },
  {
    id: "accommodation_flow",
    label: { en: "Accommodation Flow", ar: "مسار التسكين" },
    description: {
      en: "Profiles, assignments, reservations, hosting, and approvals.",
      ar: "الموظفين والتسكين والحجوزات وطلبات الاعتماد.",
    },
    modules: ["profiles", "accommodation", "reservations", "hosting_requests"],
  },
  {
    id: "employee_portal",
    label: { en: "Employee Portal", ar: "بوابة الموظف" },
    description: {
      en: "Portal content, activities, documents, surveys, and communications.",
      ar: "محتوى البوابة والأنشطة والمستندات والاستبيانات والتواصل.",
    },
    modules: [
      "portal_content",
      "activities",
      "documents",
      "surveys",
      "communications",
    ],
  },
  {
    id: "management",
    label: { en: "Management", ar: "الإدارة" },
    description: {
      en: "Reports, evaluations, billing, settings, and properties.",
      ar: "التقارير والتقييمات والفواتير والإعدادات والفروع.",
    },
    modules: ["reports", "evaluations", "billing", "settings", "properties"],
  },
  {
    id: "security",
    label: { en: "Security & Audit", ar: "الأمان والتدقيق" },
    description: {
      en: "Users, permission management, activity log, and smart locks.",
      ar: "المستخدمين وإدارة الصلاحيات وسجل النشاط والأقفال الذكية.",
    },
    modules: ["users", "activity_log", "smart_locks"],
  },
];
