// @ts-nocheck

export const MODULES = [
  "dashboard",
  "housing",
  "housekeeping",
  "profiles",
  "accommodation",
  "reservations",
  "hosting_requests",
  "guest_hosting",
  "maintenance",
  "reports",
  "users",
  "settings",
  "activity_log",
  "properties",
  "documents",
  "evaluations",
  "portal_content",
  "activities",
  "smart_locks",
  "whatsapp",
  "inventory",
  "workers",
  "hr_sync",
  "portal_notifications",
] as const;

export type Module = (typeof MODULES)[number];

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "checkin"
  | "checkout"
  | "approve"
  | "transfer"
  | "reset_password"
  | "manage_permissions"
  | "view_sensitive"
  | "audit"
  | "publish"
  | "unlock"
  | "override_single_occupancy";

export const ACTIONS: Action[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "checkin",
  "checkout",
  "approve",
  "transfer",
  "reset_password",
  "manage_permissions",
  "view_sensitive",
  "audit",
  "publish",
  "unlock",
  "override_single_occupancy",
];

export const MODULE_ACTIONS: Record<Module, Action[]> = {
  dashboard: ["view"],
  housing: ["view", "create", "edit", "delete", "export"],
  housekeeping: ["view", "edit", "export"],
  profiles: [
    "view",
    "create",
    "edit",
    "delete",
    "export",
    "reset_password",
    "view_sensitive",
  ],
  accommodation: [
    "view",
    "create",
    "edit",
    "checkout",
    "transfer",
    "export",
    "override_single_occupancy",
  ],
  reservations: [
    "view",
    "create",
    "edit",
    "checkin",
    "delete",
    "export",
    "override_single_occupancy",
  ],
  hosting_requests: ["view", "create", "edit", "delete", "approve"],
  guest_hosting: [
    "view",
    "create",
    "edit",
    "checkin",
    "checkout",
    "delete",
    "export",
  ],
  maintenance: ["view", "create", "edit", "delete", "export"],
  reports: ["view", "export", "audit"],
  users: [
    "view",
    "create",
    "edit",
    "delete",
    "export",
    "manage_permissions",
    "reset_password",
    "unlock",
  ],
  settings: ["view", "create", "edit", "delete"],
  activity_log: ["view", "export"],
  properties: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "delete"],
  evaluations: ["view", "create", "edit", "delete", "export"],
  portal_content: ["view", "create", "edit", "delete"],
  activities: ["view", "create", "edit", "delete", "publish"],
  smart_locks: ["view", "create", "edit", "unlock"],
  whatsapp: ["view", "create", "edit", "export"],
  inventory: ["view", "create", "edit", "delete", "export"],
  workers: ["view", "create", "edit", "delete", "export"],
  hr_sync: ["view", "edit", "export"],
  portal_notifications: ["view", "create", "delete"],
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
    // Housing
    ...allModulePerms("housing"),
    // Housekeeping
    ...allModulePerms("housekeeping"),
    // Profiles
    ...allModulePerms("profiles"),
    // Accommodation
    ...allModulePerms("accommodation"),
    // Reservations
    ...allModulePerms("reservations"),
    // Hosting Requests
    ...allModulePerms("hosting_requests"),
    // Guest Hosting
    ...allModulePerms("guest_hosting"),
    // Maintenance
    ...allModulePerms("maintenance"),
    // Reports
    ...allModulePerms("reports"),
    // Users
    "users.view",
    "users.edit",
    "users.export",
    "users.manage_permissions",
    "users.unlock",
    // Settings
    ...allModulePerms("settings"),
    // Activity Log
    ...allModulePerms("activity_log"),
    // Documents
    ...allModulePerms("documents"),
    // Evaluations
    ...allModulePerms("evaluations"),
    // Portal Content
    ...allModulePerms("portal_content"),
    // Activities
    ...allModulePerms("activities"),
    // Smart Locks
    ...allModulePerms("smart_locks"),
    // WhatsApp
    ...allModulePerms("whatsapp"),
    // Inventory
    ...allModulePerms("inventory"),
    // Workers
    ...allModulePerms("workers"),
    // HR Sync
    ...allModulePerms("hr_sync"),
    // Portal Notifications
    ...allModulePerms("portal_notifications"),
  ],
  receptionist: [
    "dashboard.view",
    "housing.view",
    "housing.export",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.export",
    "profiles.view",
    "accommodation.view",
    "accommodation.create",
    "accommodation.edit",
    "accommodation.checkout",
    "accommodation.transfer",
    "accommodation.export",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.checkin",
    "reservations.delete",
    "reservations.export",
    "hosting_requests.view",
    "hosting_requests.create",
    "hosting_requests.edit",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.export",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "reports.view",
    "reports.export",
    "activity_log.view",
    "documents.view",
    "whatsapp.view",
    "whatsapp.create",
    "inventory.view",
    "inventory.export",
    "workers.view",
  ],
  maintenance_staff: [
    "dashboard.view",
    "housing.view",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "maintenance.delete",
    "maintenance.export",
    "inventory.view",
    "inventory.edit",
    "workers.view",
    "workers.edit",
    "profiles.view",
    "activity_log.view",
    "documents.view",
  ],
  housekeeping_staff: [
    "dashboard.view",
    "housing.view",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.export",
    "inventory.view",
    "inventory.edit",
    "workers.view",
    "activity_log.view",
    "documents.view",
  ],
  hr_admin: [
    "dashboard.view",
    ...allModulePerms("profiles"),
    ...allModulePerms("evaluations"),
    ...allModulePerms("activities"),
    ...allModulePerms("documents"),
    ...allModulePerms("hosting_requests"),
    ...allModulePerms("guest_hosting"),
    ...allModulePerms("hr_sync"),
    ...allModulePerms("portal_notifications"),
    "whatsapp.view",
    "whatsapp.create",
    "whatsapp.export",
    "reports.view",
    "reports.export",
  ],
  portal_admin: [
    "dashboard.view",
    ...allModulePerms("portal_content"),
    ...allModulePerms("activities"),
    ...allModulePerms("evaluations"),
    ...allModulePerms("documents"),
    ...allModulePerms("portal_notifications"),
    "reports.view",
  ],
  security_staff: [
    "dashboard.view",
    "housing.view",
    "accommodation.view",
    ...allModulePerms("smart_locks"),
    "activities.view",
  ],
};

export const MODULE_LABELS: Record<Module, { en: string; ar: string }> = {
  dashboard: { en: "Dashboard & KPIs", ar: "لوحة القيادة والمؤشرات" },
  housing: { en: "Housing & Rooms", ar: "الإسكان والغرف والمباني" },
  housekeeping: { en: "Housekeeping & Cleaning", ar: "نظافة وجاهزية الغرف" },
  profiles: { en: "Profiles & Employees", ar: "دليل الموظفين والنزلاء" },
  accommodation: { en: "In-House Residents", ar: "المقيمون حالياً بالسكن" },
  reservations: { en: "Advance Reservations", ar: "الحجوزات المسبقة والتسكين" },
  hosting_requests: { en: "Hosting Requests", ar: "طلبات استضافة الزوار" },
  guest_hosting: { en: "Guest Housing", ar: "تسكين الاستضافات والزوار" },
  maintenance: { en: "Maintenance Tickets", ar: "تذاكر وبلاغات الصيانة" },
  reports: { en: "Reports & Analytics", ar: "التقارير والإحصائيات الفندقية" },
  users: { en: "Users & Governance", ar: "المستخدمون والحوكمة والصلاحيات" },
  properties: { en: "Properties & Hotels", ar: "العقارات والفروع (سوبر أدمن)" },
  portal_content: { en: "Resident Portal", ar: "محتوى وتغذية بوابة المقيمين" },
  settings: { en: "System Settings", ar: "إعدادات النظام والقوائم" },
  activity_log: { en: "Activity Audit Log", ar: "سجل النشاط والرقابة الأمنية" },
  documents: { en: "Document Archive", ar: "أرشيف المستندات والسياسات" },
  evaluations: { en: "Evaluations & Surveys", ar: "التقييمات واستبيانات الرأي" },
  activities: { en: "Portal Activities", ar: "الفعاليات والأنشطة الترفيهية" },
  smart_locks: { en: "Smart Locks & Encoders", ar: "الأقفال ومشفرات الكروت الذكية" },
  whatsapp: { en: "WhatsApp & Broadcasts", ar: "محرك الواتساب والبث الجماعي" },
  inventory: { en: "Room Amenities & Inventory", ar: "جرد العهد ومحتويات الغرف" },
  workers: { en: "Technicians & Workers", ar: "الفنيون وعمال الصيانة والنظافة" },
  hr_sync: { en: "HR Auto-Synchronization", ar: "الربط الآلي مع الموارد البشرية" },
  portal_notifications: { en: "Portal Push Notifications", ar: "إشعارات وتنبيهات البوابة" },
};

export const MODULE_DESCRIPTIONS: Record<Module, { en: string; ar: string }> = {
  dashboard: {
    en: "Occupancy overview, live metrics, and operational KPI charts.",
    ar: "إحصائيات الإشغال العامة، بطاقات المؤشرات التشغيلية، والرسوم البيانية.",
  },
  housing: {
    en: "Buildings, floors, rooms layout, space view, and capacities setup.",
    ar: "إدارة المباني، الطوابق، الغرف، مخطط وتوزيع الأسرة وسعة الإشغال.",
  },
  housekeeping: {
    en: "Room cleanliness status, dirty room queues, and cleaning task sheets.",
    ar: "متابعة نظافة الغرف، كشف مهام النظافة، والغرف الشاغرة والمتسخة.",
  },
  profiles: {
    en: "Staff and resident profiles, national IDs, documents, and portal accounts.",
    ar: "بيانات الموظفين والنزلاء، أرقام الهوية، المستندات، وحسابات البوابة.",
  },
  accommodation: {
    en: "Active in-house residents, check-outs, room transfers, and stay duration.",
    ar: "إدارة النزلاء المقيمين حالياً بالسكن، المغادرة، النقل، وفترات الإقامة.",
  },
  reservations: {
    en: "Advance room bookings, reserved check-ins, cancellations, and arrival dates.",
    ar: "الحجوزات المسبقة، تسكين النزيل عند الوصول، وإلغاء وتعديل الحجز.",
  },
  hosting_requests: {
    en: "Guest and companion hosting applications, reviews, and sign-offs.",
    ar: "طلبات استضافة الزوار والمرافقين، مراجعتها، وتوقيع واعتماد الطلبات.",
  },
  guest_hosting: {
    en: "Guest visitor accommodation check-ins, stay periods, and departures.",
    ar: "تسكين الزوار والضيوف المعتمدين، تسجيل وصولهم ومغادرتهم من السكن.",
  },
  maintenance: {
    en: "Work orders, maintenance tickets, repairs tracking, and technician dispatch.",
    ar: "بلاغات الأعطال، تكليف الفنيين، تسجيل التكاليف، وتتبع أوامر الإصلاح.",
  },
  reports: {
    en: "Comprehensive occupancy reports, Opera Cloud PMS sheets, and audit tools.",
    ar: "تقارير الإشغال المفصلة، كشوفات Opera Cloud الفندقية، وأدوات التدقيق والمطابقة.",
  },
  users: {
    en: "System credentials, role assignments, hotel access, and custom matrix.",
    ar: "حسابات المشرفين، الأدوار، الفنادق المصرح بها، ومصفوفة الصلاحيات المخصصة.",
  },
  properties: {
    en: "Hotel branches and schema isolation setup (Restricted to Super Admin).",
    ar: "إدارة الفنادق والفروع وعزل قواعد البيانات (خاص بالسوبر أدمن فقط).",
  },
  portal_content: {
    en: "Portal announcements, feeds, contact directory, and self-service items.",
    ar: "أخبار البوابة، الإعلانات، دليل أرقام التواصل، والخدمات الذاتية.",
  },
  settings: {
    en: "System branding, lookups, security policies, and Hotek lock settings.",
    ar: "سياسات النظام، القيم المنسدلة، أمان الحسابات، وإعدادات الربط.",
  },
  activity_log: {
    en: "Tamper-evident audit trail of all administrative and operational actions.",
    ar: "السجل الرقابي والتدقيق الأمني لكافة حركات وتعديلات النظام المحمية.",
  },
  documents: {
    en: "Central housing policies, forms, guides, and document repository.",
    ar: "أرشيف السياسات والنماذج والأدلة والمستندات العامة للسكن.",
  },
  evaluations: {
    en: "Staff housing satisfaction evaluations, surveys, polls, and response ratings.",
    ar: "استبيانات الرأي، تقييمات جودة سكن الموظفين، ومؤشرات الرضا.",
  },
  activities: {
    en: "Recreational activities, sports events, tournaments, and portal publishing.",
    ar: "الأنشطة الترفيهية والفعاليات المنظمة للموظفين ونشرها في البوابة.",
  },
  smart_locks: {
    en: "Hotek electronic door lock encoders, RFID keycards, and remote unlocking.",
    ar: "أجهزة تشفير Hotek، إصدار كروت الغرف الممغنطة، والفتح الطارئ للباب.",
  },
  whatsapp: {
    en: "Direct WhatsApp engine, QR device pairing, automated alerts, and broadcasts.",
    ar: "ربط هاتف الواتساب، إرسال رسائل الحجز التلقائية، وإطلاق البث الجماعي للسكان.",
  },
  inventory: {
    en: "Room amenities, equipment conditions, asset barcode tracking, and sync.",
    ar: "جرد أجهزة وأثاث الغرف، فحص الحالة (ممتازة/صيانة/تالف)، والتوليد الذكي.",
  },
  workers: {
    en: "Technicians, contractors, external labor directory, and task dispatching.",
    ar: "دليل الفنيين والعمال والمقاولين، تسجيل التخصصات، وتكليف المهام.",
  },
  hr_sync: {
    en: "Webhook endpoints, API integration, and automated employee data imports.",
    ar: "إعدادات الربط مع نظام HR، استيراد بيانات الموظفين، ومزامنة الإجازات والمغادرات.",
  },
  portal_notifications: {
    en: "Broadcast alerts and mobile push notifications to residents.",
    ar: "إرسال التنبيهات العامة وإشعارات الهاتف الفورية لمستخدمي البوابة.",
  },
};

export const ACTION_LABELS: Record<Action, { en: string; ar: string }> = {
  view: { en: "View & Browse", ar: "عرض واستعراض" },
  create: { en: "Create & Add", ar: "إضافة وإنشاء" },
  edit: { en: "Edit & Update", ar: "تعديل وتحديث" },
  delete: { en: "Delete & Cancel", ar: "حذف وإلغاء" },
  export: { en: "Export to Excel / CSV", ar: "تصدير إلى إكسيل" },
  checkin: { en: "Check-in Resident", ar: "تسجيل وصول وتسكين" },
  checkout: { en: "Check-out & Release Bed", ar: "تسجيل مغادرة وإخلاء السرير" },
  approve: { en: "Approve / Sign Request", ar: "اعتماد وتوقيع الطلب" },
  transfer: { en: "Transfer Room / Bed", ar: "نقل الغرفة / السرير" },
  reset_password: { en: "Reset Portal Password", ar: "إعادة تعيين كلمة مرور البوابة" },
  manage_permissions: { en: "Manage Permission Matrix", ar: "إدارة وتخصيص مصفوفة الصلاحيات" },
  view_sensitive: { en: "View Sensitive Data", ar: "كشف البيانات الحساسة (الرقم القومي/الراتب)" },
  audit: { en: "Field Room Discrepancy Audit", ar: "تدقيق ومطابقة الغرف الميداني" },
  publish: { en: "Publish to Portal", ar: "نشر في بوابة المقيمين" },
  unlock: { en: "Emergency Remote Door Unlock", ar: "فتح طارئ لباب الغرفة عن بُعد" },
  override_single_occupancy: {
    en: "Single Occupant / Entire Room Booking",
    ar: "تسكين غرفة كاملة / نزيل بمفرده",
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
      en: "Dashboard, housing setup, rooms, housekeeping, maintenance, and inventory.",
      ar: "لوحة المتابعة والسكن والغرف والنظافة والصيانة وجرد العهد.",
    },
    modules: ["dashboard", "housing", "housekeeping", "maintenance", "inventory"],
  },
  {
    id: "accommodation_flow",
    label: { en: "Accommodation Flow", ar: "مسار التسكين والإقامة" },
    description: {
      en: "Profiles, in-house assignments, reservations, hosting, and sign-offs.",
      ar: "الموظفون والتسكين والمقيمون والحجوزات وطلبات الاستضافة.",
    },
    modules: [
      "profiles",
      "accommodation",
      "reservations",
      "hosting_requests",
      "guest_hosting",
    ],
  },
  {
    id: "employee_portal",
    label: { en: "Resident Portal & Comms", ar: "بوابة المقيمين والتواصل" },
    description: {
      en: "Portal content, activities, documents, evaluations, and WhatsApp engine.",
      ar: "محتوى البوابة والأنشطة والمستندات والتقييمات ومحرك الواتساب.",
    },
    modules: [
      "portal_content",
      "activities",
      "documents",
      "evaluations",
      "whatsapp",
    ],
  },
  {
    id: "management",
    label: { en: "Management & Analytics", ar: "الإدارة والتحليلات" },
    description: {
      en: "Comprehensive reports, PMS audits, system settings, and properties.",
      ar: "التقارير الشاملة، تدقيق Opera Cloud، إعدادات النظام، والفروع.",
    },
    modules: ["reports", "settings", "properties"],
  },
  {
    id: "security",
    label: { en: "Security & Governance", ar: "الأمان والحوكمة والرقابة" },
    description: {
      en: "User accounts, permission matrix, activity audit log, and smart locks.",
      ar: "المستخدمون ومصفوفة الصلاحيات وسجل النشاط الرقابي والأقفال الذكية.",
    },
    modules: ["users", "activity_log", "smart_locks"],
  },
];
