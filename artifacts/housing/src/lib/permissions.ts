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
  "guest_hosting",
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
  | "unlock"
  | "override_single_occupancy";

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
  "override_single_occupancy",
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
    "delete",
    "assign",
    "checkin",
    "checkout",
    "approve",
    "transfer",
    "bulk_delete",
    "bulk_export",
    "archive",
    "override_single_occupancy",
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
    "override_single_occupancy",
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
  guest_hosting: [
    "view",
    "create",
    "edit",
    "delete",
    "checkin",
    "checkout",
    "approve",
    "transfer",
    "export",
    "bulk_export",
    "bulk_delete",
  ],
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
    "accommodation.override_single_occupancy",
    // Reservations
    ...crudPerms("reservations"),
    "reservations.checkin",
    "reservations.checkout",
    "reservations.bulk_export",
    "reservations.archive",
    "reservations.override_single_occupancy",
    // Hosting Requests
    ...crudPerms("hosting_requests"),
    // Guest Housing
    ...crudPerms("guest_hosting"),
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.transfer",
    "guest_hosting.bulk_delete",
    "guest_hosting.bulk_export",
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
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.export",
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
    ...crudPerms("guest_hosting"),
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
  housing: { en: "Housing & Rooms", ar: "الإسكان والغرف" },
  profiles: { en: "Profiles & Employees", ar: "الملفات الشخصية والموظفون" },
  reservations: { en: "Reservations", ar: "الحجوزات" },
  accommodation: { en: "In-House Accommodation", ar: "التسكين والمقيمون حالياً" },
  hosting_requests: { en: "Hosting Requests", ar: "طلبات الاستضافة" },
  guest_hosting: { en: "Guest Housing", ar: "تسكين الاستضافات" },
  housekeeping: { en: "Housekeeping", ar: "خدمات النظافة والترتيب" },
  maintenance: { en: "Tickets & Maintenance", ar: "التذاكر وبلاغات الصيانة" },
  reports: { en: "Reports & Stats", ar: "التقارير والإحصائيات" },
  users: { en: "Users & Permissions", ar: "المستخدمين والصلاحيات" },
  properties: { en: "Properties & Hotels", ar: "العقارات والفروع" },
  portal_content: { en: "Employee Portal", ar: "بوابة الموظف" },
  settings: { en: "System Settings", ar: "إعدادات النظام" },
  activity_log: { en: "Activity Log & Audit", ar: "سجل النشاط والعمليات" },
  documents: { en: "Documents", ar: "المستندات" },
  billing: { en: "Billing", ar: "الفواتير" },
  communications: { en: "Communications", ar: "الاتصالات" },
  evaluations: { en: "Evaluations", ar: "التقييمات" },
  surveys: { en: "Surveys", ar: "الاستبيانات" },
  activities: { en: "Portal Activities", ar: "أنشطة البوابة" },
  smart_locks: { en: "Smart Locks", ar: "الأقفال الذكية" },
};

export const MODULE_DESCRIPTIONS: Record<Module, { en: string; ar: string }> = {
  dashboard: {
    en: "Overall occupancy overview, real-time alerts, and KPI charts.",
    ar: "إحصائيات الإشغال العامة، بطاقات التنبيهات، والرسوم البيانية.",
  },
  housing: {
    en: "Buildings, floors, rooms, room space layout, and capacity setup.",
    ar: "المباني، الطوابق، الغرف، ومخطط وتوزيع الأسِرّة.",
  },
  profiles: {
    en: "Employee and resident profiles, documents, attachments, and notes.",
    ar: "بيانات الموظفين والنزلاء، أرقامهم، مستنداتهم، وملاحظاتهم.",
  },
  reservations: {
    en: "Advance room bookings, check-ins, cancellations, and dates.",
    ar: "الحجوزات المسبقة، تسكينها، إلغائها، وتعديل مواعيد الوصول.",
  },
  accommodation: {
    en: "Active in-house residents, check-outs, room transfers, and stay history.",
    ar: "النزلاء المقيمين حالياً بالسكن، المغادرة، النقل، والسجل التاريخي.",
  },
  hosting_requests: {
    en: "Guest and visitor hosting applications and approvals workflow.",
    ar: "طلبات استضافة الزوار والنزلاء، وإجراءات اعتماد الطلبات.",
  },
  guest_hosting: {
    en: "Guest and visitor housing assignments, check-ins, check-outs, and companion records.",
    ar: "تسكين الزوار والضيوف، تسجيل الوصول والمغادرة، وإدارة بيانات المرافقين.",
  },
  housekeeping: {
    en: "Room cleanliness status, dirty room queues, and cleaning tasks.",
    ar: "الغرف المتسخة، الشاغرة، أوامر التنظيف، وجاهزية الغرف.",
  },
  maintenance: {
    en: "Work orders, maintenance tickets, technician assignments, and repairs.",
    ar: "بلاغات الأعطال، تكليف الفنيين، وتتبع أوامر الإصلاح.",
  },
  reports: {
    en: "Detailed occupancy reports, movement tracking, and Excel/PDF exports.",
    ar: "تقارير الإشغال المفصلة، حركات التسكين، وتصدير ملفات Excel/PDF.",
  },
  users: {
    en: "System accounts, login credentials, role assignments, and permission matrix.",
    ar: "حسابات المشرفين والموظفين، ضبط كلمات المرور، ومصفوفة الصلاحيات.",
  },
  properties: {
    en: "Branch and property configurations (Restricted to Super Admin).",
    ar: "إدارة الفنادق والفروع وبيانات المنشأة (خاص بالسوبر أدمن فقط).",
  },
  portal_content: {
    en: "Employee portal announcements, feeds, self-service, and updates.",
    ar: "أخبار البوابة، الإعلانات، استطلاعات الرأي، والخدمات الذاتية.",
  },
  settings: {
    en: "System branding, logos, color scheme, password policies, and lookups.",
    ar: "هوية النظام، الألوان، السياسات العامة، وقيم القوائم.",
  },
  activity_log: {
    en: "Comprehensive security audit trail of all system actions and changes.",
    ar: "الرقابة الأمنية والتدقيق الشامل لكافة حركات وتعديلات النظام.",
  },
  documents: {
    en: "General document archive and attachments.",
    ar: "أرشيف المستندات والوثائق العامة.",
  },
  billing: {
    en: "Housing billing, utility charges, and financial exports.",
    ar: "فواتير السكن، الرسوم والخدمات، وتصدير السجلات المالية.",
  },
  communications: {
    en: "Internal announcements, broadcast alerts, and notifications.",
    ar: "التعاميم الداخلية والتنبيهات العامة للموظفين.",
  },
  evaluations: {
    en: "Employee housing satisfaction evaluations and ratings.",
    ar: "تقييمات سكن الموظفين وجودة الخدمات ومؤشرات الرضا.",
  },
  surveys: {
    en: "Staff polls, question sets, and survey feedback.",
    ar: "استبيانات الرأي والتصويت واستطلاعات الموظفين.",
  },
  activities: {
    en: "Recreational activities and staff events management.",
    ar: "الأنشطة الترفيهية والفعاليات المنظمة للموظفين.",
  },
  smart_locks: {
    en: "Smart electronic door locks, RFID cards, and digital key cards.",
    ar: "الأقفال الإلكترونية الذكية، بطاقات الدخول، والمفاتيح الرقمية.",
  },
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
  override_single_occupancy: {
    en: "Assign Room with Single Occupant / Full Room",
    ar: "تسكين غرفة بها نزيل بمفرده / حجز غرفة كاملة",
  },
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
    modules: [
      "profiles",
      "accommodation",
      "reservations",
      "guest_hosting",
      "hosting_requests",
    ],
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
