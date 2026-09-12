#!/usr/bin/env node
/**
 * Sunrise Housing Codebase Feature & Architecture Lookup Tool
 * Usage:
 *   node scripts/code-lookup.mjs <query>
 *   node scripts/code-lookup.mjs --list
 * Examples:
 *   node scripts/code-lookup.mjs reservations
 *   node scripts/code-lookup.mjs "تسكين"
 *   node scripts/code-lookup.mjs transfer
 *   node scripts/code-lookup.mjs hotek
 *   node scripts/code-lookup.mjs maintenance
 *   node scripts/code-lookup.mjs portal
 *   node scripts/code-lookup.mjs guest
 */

import { execSync } from "child_process";
import path from "path";

const REGISTRY = [
  {
    id: "reservations",
    name: "Reservations & Check-In Wizard / معالج الحجوزات والتسكين المباشر",
    keywords: ["reservation", "reservations", "حجز", "حجوزات", "تسكين مباشر", "wizard", "cross-property", "fate", "archiveSourceProfile"],
    frontend: {
      route: "/:property/accommodation/reservations",
      page: "artifacts/housing/src/pages/accommodation/reservations/ReservationsPage.tsx",
      components: [
        "ReservationsPage.tsx (Steps: 1. Profile select/create -> 2. Room select -> 3. Cross-property confirmation modal -> 4. Submit)",
      ],
      state: "searchQuery, searchPropertyId, isCrossProperty, showCrossConfirmModal, transferFate",
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/reservations.ts (GET /, POST /, PATCH /:id, DELETE /:id, POST /:id/check-in)",
        "artifacts/api-server/src/routes/assignments.ts (POST / createAssignmentMutation - handles cross-property transfer and profile archive at lines 418-472)",
        "artifacts/api-server/src/lib/cross-property-service.ts (Cross-property copy, archive & assignment migration)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/reservations.ts (reservations table)",
        "lib/db/src/schema/assignments.ts (assignments table)",
        "lib/db/src/schema/profiles.ts (profiles table - status: ACTIVE, ARCHIVED, etc.)",
      ],
    },
    notes: "When a guest is from another property, modal prompts user to either keep profile active or archive/hide from old property.",
  },
  {
    id: "in_house",
    name: "In-House Active Occupants & Bed Transfers / المقيمون حالياً ونقل الأسرة والمغادرة",
    keywords: ["in-house", "inhouse", "occupant", "occupants", "نزلاء", "مقيمون", "checkout", "transfer", "bed transfer", "مغادرة", "نقل سرير"],
    frontend: {
      route: "/:property/accommodation/in-house",
      page: "artifacts/housing/src/pages/accommodation/in-house.tsx",
      components: [
        "in-house.tsx (Occupants table, Checkout Dialog, Transfer Bed Modal with cross-property fate choices, Key Card Issuance Dialog)",
      ],
      state: "transferTargetProperty, transferActionType, archiveOldProfile, isCrossProperty",
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/assignments.ts (GET /, PATCH /:id/checkout, POST /:id/transfer, POST /:id/cancel-checkout)",
        "artifacts/api-server/src/routes/rooms.ts (GET /:id/occupants)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/assignments.ts (status: active, completed, cancelled, transferred)",
        "lib/db/src/schema/rooms.ts (current_occupancy, max_occupancy, status)",
      ],
    },
    notes: "Checkout automatically sets room status to 'dirty' and decrements room occupancy.",
  },
  {
    id: "room_assignment",
    name: "Smart Room Assignment Recommender / التسكين الذكي ومقترح الغرف",
    keywords: ["room-assignment", "assignment", "recommender", "smart assign", "تسكين ذكي", "اقتراح غرف"],
    frontend: {
      route: "/:property/accommodation/room-assignment",
      page: "artifacts/housing/src/pages/accommodation/room-assignment.tsx",
      components: [
        "room-assignment.tsx (Employee search across all properties, Matching algorithm based on department/gender/job level, Cross-property transfer dialog)",
      ],
      state: "searchPropertyId, selectedProfile, selectedRoom, isCrossProperty, showConfirmDialog",
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/assignments.ts (POST / create assignment)",
        "artifacts/api-server/src/routes/rooms.ts (GET / with capacity & vacancy filters)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/assignments.ts",
        "lib/db/src/schema/rooms.ts",
      ],
    },
  },
  {
    id: "history",
    name: "Accommodation History & Archive / سجل التسكين والأرشيف التاريخي",
    keywords: ["history", "archive", "past stays", "سجل التسكين", "أرشيف الإقامة", "تاريخ"],
    frontend: {
      route: "/:property/accommodation/history",
      page: "artifacts/housing/src/pages/accommodation/history.tsx",
      components: [
        "history.tsx (Historical stay logs, Checkout reasons, Departure filters, Excel & PDF export)",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/assignments.ts (GET /history)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/assignments.ts (checkout_date, checkout_reason, status='completed'|'transferred')",
      ],
    },
  },
  {
    id: "guest_hosting",
    name: "Guest Hosting & Family Visits / استضافة الضيوف والزيارات العائلية",
    keywords: ["guest", "hosting", "family visit", "companion", "استضافة", "ضيوف", "زيارة عائلية", "مرافقين"],
    frontend: {
      route: "/:property/accommodation/guest-hosting & /:property/hosting-requests/*",
      page: "artifacts/housing/src/pages/accommodation/guest-hosting/GuestHostingPage.tsx",
      components: [
        "GuestHostingPage.tsx",
        "EditHostingDialog.tsx",
        "HostingRequestsList.tsx: artifacts/housing/src/pages/hosting-requests/HostingRequestsList.tsx",
        "CreateHostingRequest.tsx, EditHostingRequest.tsx, HostingRequestDetail.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/hostings.ts (GET /, POST /, PATCH /:id)",
        "artifacts/api-server/src/routes/hosting-requests.ts (Approvals, workflows, companions)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/hostings.ts",
        "lib/db/src/schema/hosting_companions.ts",
        "lib/db/src/schema/family_visit.ts",
      ],
    },
  },
  {
    id: "housing_rooms",
    name: "Housing: Buildings, Floors & Rooms / إدارة السكن والمباني والأدوار والغرف",
    keywords: ["housing", "building", "buildings", "floor", "floors", "room", "rooms", "مبنى", "مباني", "دور", "أدوار", "غرفة", "غرف"],
    frontend: {
      route: "/:property/housing",
      page: "artifacts/housing/src/pages/housing/HousingPage.tsx",
      components: [
        "BuildingsTab: artifacts/housing/src/pages/housing/components/buildings/BuildingsTab.tsx",
        "BuildingModals: artifacts/housing/src/pages/housing/components/buildings/BuildingModals.tsx",
        "FloorsTab: artifacts/housing/src/pages/housing/components/floors/FloorsTab.tsx",
        "FloorModals: artifacts/housing/src/pages/housing/components/floors/FloorModals.tsx",
        "RoomsTab: artifacts/housing/src/pages/housing/components/rooms/RoomsTab.tsx",
        "RoomsTable: artifacts/housing/src/pages/housing/components/rooms/RoomsTable.tsx",
        "RoomModals: artifacts/housing/src/pages/housing/components/rooms/RoomModals.tsx",
        "RoomDetailsDialog: artifacts/housing/src/pages/housing/components/RoomDetailsDialog.tsx",
        "RoomSpaceViewTab: artifacts/housing/src/pages/housing/components/RoomSpaceViewTab.tsx",
        "AvailabilityTab: artifacts/housing/src/pages/housing/components/AvailabilityTab.tsx",
        "OccupancyTab: artifacts/housing/src/pages/housing/components/OccupancyTab.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/buildings.ts (GET /, POST /, PATCH /:id, DELETE /:id)",
        "artifacts/api-server/src/routes/floors.ts (GET /, POST /, PATCH /:id, DELETE /:id)",
        "artifacts/api-server/src/routes/rooms.ts (GET /, POST /, PATCH /:id, DELETE /:id, GET /:id/occupants, GET /:id/logs)",
        "artifacts/api-server/src/routes/room-import.ts (Excel room import)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/buildings.ts",
        "lib/db/src/schema/floors.ts",
        "lib/db/src/schema/rooms.ts",
      ],
    },
  },
  {
    id: "housekeeping",
    name: "Housekeeping & Cleanliness Lifecycle / النظافة وحالة الغرف",
    keywords: ["housekeeping", "clean", "cleaning", "dirty", "نظافة", "غرف متسخة", "تنظيف", "room status"],
    frontend: {
      route: "/:property/housekeeping (and Housing -> Housekeeping tab)",
      page: "artifacts/housing/src/pages/housekeeping/index.tsx",
      components: [
        "artifacts/housing/src/pages/housing/components/HousekeepingTab.tsx (Batch clean buttons, priority flags, Excel export)",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/rooms.ts (PATCH /:id/clean-status, POST /batch-clean)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/rooms.ts (cleanliness_status: clean, dirty, inspected, cleaning_in_progress)",
      ],
    },
    notes: "Lifecycle: Check-out triggers dirty -> cleaner marks cleaned -> status returns to available/occupied.",
  },
  {
    id: "profiles",
    name: "Profiles & Employee Directory / دليل وملفات الموظفين",
    keywords: ["profile", "profiles", "employee", "employees", "staff", "موظف", "موظفين", "ملفات شخصية", "إجازات", "vacation"],
    frontend: {
      route: "/:property/profiles & /:property/profiles/:id",
      page: "artifacts/housing/src/pages/profiles/ProfilesPage.tsx & detail.tsx",
      components: [
        "ProfileDialog (Create): artifacts/housing/src/pages/profiles/components/ProfileDialog.tsx",
        "EditProfileDialog: artifacts/housing/src/pages/profiles/components/EditProfileDialog.tsx",
        "ExcelImportDialog: artifacts/housing/src/pages/profiles/components/ExcelImportDialog.tsx",
        "PhotoUploadBtn: artifacts/housing/src/pages/profiles/components/PhotoUploadBtn.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/profiles.ts (GET /, POST /, GET /:id, PATCH /:id, DELETE /:id, POST /bulk-import, POST /:id/photo)",
        "artifacts/api-server/src/routes/hr-sync.ts (Sync with external HR databases)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/profiles.ts (staff_id, national_id, department, job_title, status, photo_url)",
        "lib/db/src/schema/documents.ts (national ID cards, contracts)",
      ],
    },
  },
  {
    id: "maintenance",
    name: "Maintenance & Work Orders / الصيانة وأوامر العمل والتذاكر",
    keywords: ["maintenance", "ticket", "work order", "technician", "repair", "صيانة", "تذكرة", "تذاكر", "أعطال", "فني"],
    frontend: {
      route: "/:property/maintenance & /:property/maintenance/:id",
      page: "artifacts/housing/src/pages/maintenance.tsx & maintenance-details.tsx",
      components: [
        "maintenance.tsx (Ticket list, Priority filters, Create Ticket Dialog, Technician Assignment)",
        "maintenance-details.tsx (Status progress bar, Photo attachments, Work logs)",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/maintenance.ts (GET /, POST /, GET /:id, PATCH /:id, POST /:id/comments, POST /:id/photos)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/maintenance.ts (maintenance_tickets table: status, priority, category, assigned_to)",
      ],
    },
  },
  {
    id: "users_rbac",
    name: "Users, Roles & RBAC Matrix / إدارة المستخدمين ومصفوفة الصلاحيات والحوكمة",
    keywords: ["user", "users", "rbac", "permission", "permissions", "matrix", "role", "roles", "صلاحيات", "مستخدمين", "مصفوفة", "أدوار"],
    frontend: {
      route: "/:property/users & /:property/users/:id",
      page: "artifacts/housing/src/pages/users/index.tsx & detail.tsx",
      components: [
        "PermissionMatrixCenter.tsx: artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx",
        "PermissionMatrixDialog.tsx: artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx",
        "CreateUserDialog.tsx & EditUserDialog.tsx: artifacts/housing/src/pages/users/components/",
        "EditPropertiesDialog.tsx (Hotel property multi-assignment)",
        "PermissionGate.tsx: artifacts/housing/src/components/auth/PermissionGate.tsx",
        "usePermission hook: artifacts/housing/src/hooks/use-permission.tsx",
        "Permissions Definition: artifacts/housing/src/lib/permissions.ts",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/users.ts (GET /, POST /, GET /:id, PATCH /:id, DELETE /:id, PATCH /:id/permissions)",
        "artifacts/api-server/src/routes/auth.ts (POST /login, POST /logout, GET /me)",
        "artifacts/api-server/src/middlewares/permissions.js (requirePermission middleware)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/users.ts (users table: role, permissions JSON, allowed_properties)",
        "lib/db/src/schema/user_signatures.ts",
        "lib/db/src/schema/password_history.ts",
      ],
    },
  },
  {
    id: "settings",
    name: "System Settings & Integrations / الإعدادات وقوائم النظام والتكامل",
    keywords: ["setting", "settings", "lookup", "lookups", "hotek", "door lock", "hr sync", "إعدادات", "قوائم", "أقفال", "هوتك"],
    frontend: {
      route: "/:property/settings",
      page: "artifacts/housing/src/pages/settings/index.tsx",
      components: [
        "LookupSection.tsx (Nationalities, Departments, Job Titles, Room Types)",
        "DoorLocksSection.tsx (Hotek Encoders & Lock server config)",
        "HrSyncSection.tsx (HR external sync triggers & schedules)",
        "SecuritySettings.tsx (Password policies, 2FA, session timeout)",
        "JobTitlesImportDialog.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/settings.ts (GET /, PATCH /)",
        "artifacts/api-server/src/routes/lookup_values.ts (GET /, POST /, PATCH /:id, DELETE /:id)",
        "artifacts/api-server/src/routes/hotek-config.ts & smart-lock.ts",
        "artifacts/api-server/src/lib/pms-server.ts (TCP Socket server for Hotek PMS on port 10006)",
        "artifacts/api-server/src/routes/hr-sync.ts",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/settings.ts",
        "lib/db/src/schema/lookup_values.ts",
        "lib/db/src/schema/hotek.ts (hotek_encoders, hotek_settings)",
      ],
    },
  },
  {
    id: "properties",
    name: "Multi-Property & Schema Isolation / الفنادق والخصائص وعزل قواعد البيانات",
    keywords: ["property", "properties", "tenant", "tenants", "schema", "multi-tenant", "فندق", "خصائص", "سكيما"],
    frontend: {
      route: "/properties (global) and /:property/* (prefixed routes)",
      page: "artifacts/housing/src/pages/properties.tsx",
      components: [
        "PropertyContext: artifacts/housing/src/context/PropertyContext.tsx",
        "Slug routing: artifacts/housing/src/lib/property-slug.ts",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/properties.ts (GET /, POST /, PATCH /:id)",
        "artifacts/api-server/src/lib/db.ts (withTenant helper setting search_path)",
        "artifacts/api-server/src/lib/migrations.ts (auto-runs migrations on all tenant schemas)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/properties.ts (stored in public schema)",
        "Tenant schemas: taal_housing, el_waha_new, elwaha_old",
      ],
    },
  },
  {
    id: "portal",
    name: "Employee Portal PWA / بوابة الموظفين وتطبيق الهاتف",
    keywords: ["portal", "employee portal", "pwa", "mobile", "app", "بوابة الموظفين", "موبايل", "تطبيق الهاتف", "chat", "محادثة"],
    frontend: {
      route: "http://localhost:10000 (standalone React + Capacitor PWA)",
      page: "artifacts/employee-portal/src/App.tsx",
      components: [
        "Dashboard Shell: artifacts/employee-portal/src/pages/dashboard.tsx",
        "Login & Biometrics: artifacts/employee-portal/src/pages/login.tsx",
        "Forgot Password: artifacts/employee-portal/src/pages/forgot-password.tsx",
        "Request Details: artifacts/employee-portal/src/pages/request-details.tsx",
        "Overview Tab: artifacts/employee-portal/src/components/TabOverview.tsx",
        "Requests Tab: artifacts/employee-portal/src/components/TabRequests.tsx",
        "Documents Tab: artifacts/employee-portal/src/components/TabDocuments.tsx",
        "Chat Tab: artifacts/employee-portal/src/components/chat/ChatContainer.tsx",
        "Activities Tab: artifacts/employee-portal/src/components/TabActivities.tsx",
        "Food & Transport: artifacts/employee-portal/src/components/TabFood.tsx, TabTransport.tsx",
        "Settings & PWA: artifacts/employee-portal/src/components/TabPortalSettings.tsx, PWAInstallBanner.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/portal-auth.ts (Login, reset password, verify national ID & room)",
        "artifacts/api-server/src/routes/portal-data.ts (Requests, overview, roommates)",
        "artifacts/api-server/src/routes/portal-chat.ts (Direct messaging & WebSocket push)",
        "artifacts/api-server/src/routes/activities.ts (Events & registrations)",
        "artifacts/api-server/src/routes/push-notifications.ts (Web push & FCM)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/profile_portal.ts",
        "lib/db/src/schema/portal_chat.ts",
        "lib/db/src/schema/portal_notifications.ts",
        "lib/db/src/schema/activities.ts",
      ],
    },
  },
  {
    id: "room_inventory",
    name: "Room Amenities & Equipment Inventory / جرد محتويات ومعدات الغرف",
    keywords: ["inventory", "equipment", "amenities", "asset", "assets", "جرد", "معدات", "محتويات الغرف", "عهد"],
    frontend: {
      route: "Housing -> Room Details Dialog & Reports -> Amenities Tab",
      page: "artifacts/housing/src/pages/housing/components/RoomDetailsDialog.tsx",
      components: [
        "artifacts/housing/src/pages/reports/components/AmenitiesInventoryTab.tsx",
        "RoomDetailsDialog.tsx (Equipment inventory card, barcode, condition dropdown, add asset)",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/room-inventory.ts (GET /room/:roomId, POST /room/:roomId, PATCH /:id, DELETE /:id, POST /sync-amenities)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/room_inventory.ts",
      ],
    },
  },
  {
    id: "dashboard_kpi",
    name: "Dashboard, KPIs & Analytics / لوحة التحكم والمؤشرات التشغيلية",
    keywords: ["dashboard", "kpi", "analytics", "occupancy rate", "لوحة التحكم", "مؤشرات", "إحصائيات", "إشغال"],
    frontend: {
      route: "/:property/dashboard",
      page: "artifacts/housing/src/pages/dashboard.tsx",
      components: [
        "DailyOperationsHub.tsx: artifacts/housing/src/pages/dashboard/components/DailyOperationsHub.tsx",
        "BuildingCapacityMatrix.tsx: artifacts/housing/src/pages/dashboard/components/BuildingCapacityMatrix.tsx",
        "HousekeepingPriorityQueue.tsx: artifacts/housing/src/pages/dashboard/components/HousekeepingPriorityQueue.tsx",
        "DashboardAnalyticsDonut.tsx: artifacts/housing/src/pages/dashboard/components/DashboardAnalyticsDonut.tsx",
        "ReadinessTrackerBar.tsx: artifacts/housing/src/pages/dashboard/components/ReadinessTrackerBar.tsx",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/dashboard.ts (GET /stats, GET /occupancy-trends, GET /building-stats)",
      ],
    },
    database: {
      schemas: [
        "Aggregate queries across rooms, assignments, maintenance_tickets",
      ],
    },
  },
  {
    id: "activity_log",
    name: "Activity Log & Audit Trail / سجل حركات النظام والتدقيق الأمني",
    keywords: ["activity", "activity log", "audit", "logs", "سجل الحركات", "تدقيق", "عمليات النظام"],
    frontend: {
      route: "/:property/activity-log",
      page: "artifacts/housing/src/pages/activity-log.tsx",
      components: [
        "activity-log.tsx (User actions, timestamps, entity IDs, IP addresses, server-side pagination)",
      ],
    },
    backend: {
      routes: [
        "artifacts/api-server/src/routes/activity_logs.ts (GET / with entity, action, date filters)",
      ],
    },
    database: {
      schemas: [
        "lib/db/src/schema/activity_logs.ts",
      ],
    },
  },
];

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
🔍 Sunrise Housing Codebase Feature & Architecture Lookup
---------------------------------------------------------
Usage:
  node scripts/code-lookup.mjs <query>
  node scripts/code-lookup.mjs --list

Examples:
  node scripts/code-lookup.mjs reservations
  node scripts/code-lookup.mjs "تسكين"
  node scripts/code-lookup.mjs transfer
  node scripts/code-lookup.mjs hotek
  node scripts/code-lookup.mjs maintenance
  node scripts/code-lookup.mjs portal
  node scripts/code-lookup.mjs guest
`);
    process.exit(0);
  }

  if (args[0] === "--list") {
    console.log(`\n📋 Available Modules & Features in Registry (${REGISTRY.length}):\n`);
    for (const item of REGISTRY) {
      console.log(`- [${item.id}]: ${item.name}`);
      console.log(`  Keywords: ${item.keywords.join(", ")}`);
    }
    console.log("");
    process.exit(0);
  }

  const query = args.join(" ").toLowerCase().trim();
  const matches = REGISTRY.filter((item) => {
    if (item.id.toLowerCase().includes(query)) return true;
    if (item.name.toLowerCase().includes(query)) return true;
    return item.keywords.some((k) => k.toLowerCase().includes(query) || query.includes(k.toLowerCase()));
  });

  if (matches.length === 0) {
    console.log(`\n⚠️ No direct registry matches for: "${query}"`);
    console.log(`Running fast file search across routes and pages...\n`);
    try {
      const gitGrep = execSync(`git grep -n -i "${query}" -- "artifacts/housing/src/pages" "artifacts/api-server/src/routes" "lib/db/src/schema"`, {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });
      const lines = gitGrep.split("\n").slice(0, 15);
      console.log(`Found relevant file references:\n`);
      lines.forEach((l) => console.log(l));
    } catch {
      console.log(`Run 'node scripts/code-lookup.mjs --list' to see all registered features.\n`);
    }
    process.exit(0);
  }

  console.log(`\n🎯 Found ${matches.length} matching feature(s) for "${query}":\n`);
  for (const m of matches) {
    console.log(`================================================================================`);
    console.log(`📌 Feature: ${m.name} [ID: ${m.id}]`);
    console.log(`================================================================================`);
    if (m.frontend) {
      console.log(`🌐 FRONTEND:`);
      console.log(`   Route: ${m.frontend.route}`);
      console.log(`   Main File: ${m.frontend.page}`);
      if (m.frontend.components && m.frontend.components.length > 0) {
        console.log(`   Key Components:`);
        m.frontend.components.forEach((c) => console.log(`     - ${c}`));
      }
      if (m.frontend.state) {
        console.log(`   Key State: ${m.frontend.state}`);
      }
    }
    if (m.backend) {
      console.log(`\n⚙️ BACKEND API:`);
      m.backend.routes.forEach((r) => console.log(`   - ${r}`));
    }
    if (m.database) {
      console.log(`\n🗄️ DATABASE & SCHEMA:`);
      m.database.schemas.forEach((s) => console.log(`   - ${s}`));
    }
    if (m.notes) {
      console.log(`\n💡 INVARIANTS & NOTES:\n   ${m.notes}`);
    }
    console.log("");
  }
}

main();
