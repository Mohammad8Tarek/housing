---
name: sunrise-housing
description: >-
  Official skill and development runbook for the Sunrise Staff Housing Management System.
  Covers multi-tenant PostgreSQL 18 schema management, zero-data-loss migrations,
  server-side pagination, dual-layer RBAC permissions, bilingual UI standards,
  and Hotek PMS lock integrations.
  Activate whenever modifying, testing, debugging, or deploying the Sunrise Housing codebase.
---

# Sunrise Staff Housing Management - Official Skill & Runbook

## 1. Project Context & Stack
- **Application Name:** Sunrise Staff Housing Management System
- **Frontend (`artifacts/housing`):** React 18, Vite, TypeScript, TailwindCSS, Shadcn UI, TanStack Query v5, Lucide React, Sonner.
- **Backend (`artifacts/api-server`):** Node.js (ESM), Express, Drizzle ORM, `pg-pool`, WebSocket server, BullMQ/Queue workers.
- **Database:** PostgreSQL 18 with Multi-Tenant Schema Isolation (`public` for global tables, `taal_housing`, `el_waha_new`, `elwaha_old` for hotel properties).
- **Mobile/Portal (`artifacts/employee-portal`):** Capacitor Android & Web Portal.
- **Lock Management:** Hotek PMS Lock TCP Socket Bridge (Port 10006).
- **CLI Navigation:** `node scripts/code-lookup.mjs <query>` (e.g. `node scripts/code-lookup.mjs reservations` or `"تسكين"`).

---

## 2. Core Architectural Invariants (Must Never Be Broken)

### Rule 1: Zero Data Loss Database Migrations
- **Never** write destructive queries (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`).
- All migrations must be idempotent:
  - `CREATE TABLE IF NOT EXISTS`
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  - `DO $$ BEGIN ... DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT ... END $$;`
- Whenever adding a new column to a table:
  1. Add it to the Drizzle schema in `lib/db/src/schema/*.ts`.
  2. Add it to the API route in `artifacts/api-server/src/routes/*.ts`.
  3. Add it to `artifacts/api-server/src/lib/migrations.ts` in both `MIGRATIONS` and `TENANT_MIGRATIONS`.
  4. Add it to `lib/db/src/migrations/20260904_complete_schema_and_constraints.sql`.
- **Seeder Safety:** `artifacts/api-server/src/lib/seeder.ts` contains a safety guard that aborts if records exist in `properties` or `users`. Never remove this guard.

### Rule 2: Dual-Layer Role & Permission Enforcement (RBAC)
- **Layer 1 (Frontend):** Wrap all interactive buttons, action bars, and edit modals with `<PermissionGate module="module_name" action="action_name">`.
- **Layer 2 (Backend API):** Protect all Express routes with `requirePermission('module_name', 'action_name')` from `../middlewares/permissions.js`.
- Sensitive global endpoints (`/api/properties`) are strictly restricted to `super_admin`.

### Rule 3: Server-Side Pagination & Debounced Search
- Any view or table that can grow beyond 10 items (Profiles, In-House, Reservations, Maintenance, Activity Logs, Settings Lookups) must implement:
  1. Server-side `page`, `limit`, `search`, and status query parameters.
  2. Frontend `useDebounce(searchQuery, 300)` hook to prevent search spamming.
  3. `<DataPagination>` component with selectable page sizes (`10, 15, 20, 25, 50, 100`) and total record counters.
  4. Avoid client-side `.slice()` on large datasets.

### Rule 4: Bilingual (Arabic RTL / English LTR) & No Overflow Tables
- Tables must maintain visual balance:
  - Use `table-fixed` layouts.
  - Truncate long strings with badges or tooltips.
  - Avoid wide horizontal scrolling by combining complementary data in single cells (e.g., Room + Bed Badge + Building Name in one cell; Stay Dates + Nights Count in one cell).
  - All labels, dialog titles, placeholders, and toasts must have bilingual support using `const ar = language === "ar";`.

### Rule 5: State Synchronization & Room Lifecycle
- Room status cycle:
  - Vacant: `available`
  - Occupied: `occupied`
  - Check-out: Must automatically transition room to `dirty`, decrement occupancy, and release bed.
  - Cleaning action: `dirty` -> `available`; `occupied_dirty` -> `occupied`.
  - Vacation: `occupied_vacation` (keeps assignment active while marking profile as `VACATION`).
  - Maintenance: `out_of_service` or `out_of_order`.
- Entire Room Booking: Checked via `assignments.is_entire_room`. When true, room is considered fully occupied regardless of remaining bed capacity.

### Rule 6: Cross-Property Profile Transfers
- When transferring/booking an employee from a different property:
  1. Prompt user with confirmation modal for profile fate:
     - `archiveSourceProfile: true` -> Move to new property and archive/hide from old property.
     - `archiveSourceProfile: false` -> Keep profile active in old property as well.
  2. Terminate prior active accommodation via `checkoutPreviousAssignment: true`.
  3. Backend logic lives in `artifacts/api-server/src/routes/assignments.ts` (lines 418-472) & `artifacts/api-server/src/lib/cross-property-service.ts`.

---

## 3. Standard Verification & Deployment Procedure

Whenever completing any coding task:

```bash
# 1. Verify Frontend Build (Must exit with code 0)
cd artifacts/housing
npm run build

# 2. Verify API Server Build (Must exit with code 0)
cd ../api-server
npm run build

# 3. Test Migrations (Idempotent execution across all schemas)
cd ../../lib/db
$env:DATABASE_URL="postgresql://postgres:admin123@localhost:5432/staff-housing"
npx tsx src/run-migration.ts

# 4. Check Git Status and Commit Cleanly
cd ../..
git status
git add <modified-files>
git commit -m "feat/fix(scope): clear description of change"
git push origin main
```

---

## 4. Instant Feature-to-File Fast Navigation Matrix

Always consult this direct map before editing code (or run `node scripts/code-lookup.mjs <feature>`):

| Feature / Module | Frontend File(s) & Components | Backend Route(s) | Database Tables |
|---|---|---|---|
| **Reservations Wizard (حجوزات وتسكين)** | `artifacts/housing/src/pages/accommodation/reservations/ReservationsPage.tsx` | `artifacts/api-server/src/routes/reservations.ts`<br>`artifacts/api-server/src/routes/assignments.ts` (L418-472)<br>`artifacts/api-server/src/lib/cross-property-service.ts` | `reservations`<br>`assignments`<br>`profiles` |
| **In-House & Bed Transfer (مقيمون ونقل أسرة)** | `artifacts/housing/src/pages/accommodation/in-house.tsx` *(Checkout, Transfer, Keys)* | `artifacts/api-server/src/routes/assignments.ts`<br>`artifacts/api-server/src/routes/rooms.ts` | `assignments`<br>`rooms` |
| **Smart Room Assignment (تسكين ذكي)** | `artifacts/housing/src/pages/accommodation/room-assignment.tsx` | `artifacts/api-server/src/routes/assignments.ts`<br>`artifacts/api-server/src/routes/rooms.ts` | `assignments`<br>`rooms` |
| **History & Archive (سجل التسكين)** | `artifacts/housing/src/pages/accommodation/history.tsx` | `artifacts/api-server/src/routes/assignments.ts` (`GET /history`) | `assignments` |
| **Guest Hosting (استضافة وزيارات)** | `artifacts/housing/src/pages/accommodation/guest-hosting/GuestHostingPage.tsx`<br>`artifacts/housing/src/pages/hosting-requests/*` | `artifacts/api-server/src/routes/hostings.ts`<br>`artifacts/api-server/src/routes/hosting-requests.ts` | `hostings`<br>`hosting_companions`<br>`family_visit` |
| **Housing: Rooms & Buildings (مباني وغرف)** | `artifacts/housing/src/pages/housing/HousingPage.tsx`<br>`components/buildings/*`<br>`components/floors/*`<br>`components/rooms/*`<br>`RoomDetailsDialog.tsx`<br>`RoomSpaceViewTab.tsx` | `artifacts/api-server/src/routes/buildings.ts`<br>`artifacts/api-server/src/routes/floors.ts`<br>`artifacts/api-server/src/routes/rooms.ts`<br>`artifacts/api-server/src/routes/room-import.ts` | `buildings`<br>`floors`<br>`rooms` |
| **Room Amenities Inventory (جرد العهد)** | `artifacts/housing/src/pages/housing/components/RoomDetailsDialog.tsx`<br>`artifacts/housing/src/pages/reports/components/AmenitiesInventoryTab.tsx` | `artifacts/api-server/src/routes/room-inventory.ts` | `room_inventory` |
| **Housekeeping (نظافة الغرف)** | `artifacts/housing/src/pages/housekeeping/index.tsx`<br>`artifacts/housing/src/pages/housing/components/HousekeepingTab.tsx` | `artifacts/api-server/src/routes/rooms.ts` (`clean-status`, `batch-clean`) | `rooms` (`cleanliness_status`) |
| **Profiles & Employees (دليل الموظفين)** | `artifacts/housing/src/pages/profiles/ProfilesPage.tsx`<br>`artifacts/housing/src/pages/profiles/detail.tsx`<br>`components/ProfileDialog.tsx`<br>`components/EditProfileDialog.tsx`<br>`components/ExcelImportDialog.tsx` | `artifacts/api-server/src/routes/profiles.ts`<br>`artifacts/api-server/src/routes/hr-sync.ts` | `profiles`<br>`documents`<br>`profile_portal` |
| **Maintenance Tickets (صيانة وأعطال)** | `artifacts/housing/src/pages/maintenance.tsx`<br>`artifacts/housing/src/pages/maintenance-details.tsx` | `artifacts/api-server/src/routes/maintenance.ts` | `maintenance_tickets` |
| **Users & RBAC (مستخدمين وصلاحيات)** | `artifacts/housing/src/pages/users/index.tsx`<br>`artifacts/housing/src/pages/users/detail.tsx`<br>`components/PermissionMatrixCenter.tsx`<br>`components/PermissionMatrixDialog.tsx`<br>`components/CreateUserDialog.tsx`<br>`components/EditUserDialog.tsx`<br>`components/EditPropertiesDialog.tsx` | `artifacts/api-server/src/routes/users.ts`<br>`artifacts/api-server/src/routes/auth.ts`<br>`artifacts/api-server/src/middlewares/permissions.js`<br>`artifacts/api-server/src/routes/user-signature.ts` | `users`<br>`user_signatures`<br>`password_history` |
| **Settings & Integrations (إعدادات النظام)** | `artifacts/housing/src/pages/settings/index.tsx`<br>`components/LookupSection.tsx`<br>`components/DoorLocksSection.tsx`<br>`components/HrSyncSection.tsx`<br>`components/SecuritySettings.tsx` | `artifacts/api-server/src/routes/settings.ts`<br>`artifacts/api-server/src/routes/lookup_values.ts`<br>`artifacts/api-server/src/routes/hotek-config.ts`<br>`artifacts/api-server/src/routes/smart-lock.ts`<br>`artifacts/api-server/src/lib/pms-server.ts` | `settings`<br>`lookup_values`<br>`hotek_encoders`<br>`hotek_settings` |
| **Properties Isolation (فنادق وسكيما)** | `artifacts/housing/src/context/PropertyContext.tsx`<br>`artifacts/housing/src/pages/properties.tsx` | `artifacts/api-server/src/routes/properties.ts`<br>`artifacts/api-server/src/lib/db.ts` (`withTenant`) | `public.properties`<br>Tenant schemas |
| **Dashboard & Operations (لوحة التحكم)** | `artifacts/housing/src/pages/dashboard.tsx`<br>`DailyOperationsHub.tsx`<br>`BuildingCapacityMatrix.tsx`<br>`HousekeepingPriorityQueue.tsx` | `artifacts/api-server/src/routes/dashboard.ts` | Aggregates from `rooms`, `assignments`, `maintenance` |
| **Activity Log (سجل النشاط)** | `artifacts/housing/src/pages/activity-log.tsx` | `artifacts/api-server/src/routes/activity_logs.ts` | `activity_logs` |
| **Resident Portal (بوابة الموظفين PWA)** | `artifacts/employee-portal/src/pages/dashboard.tsx`<br>`src/pages/login.tsx`<br>`src/pages/forgot-password.tsx`<br>`src/pages/request-details.tsx`<br>`components/TabOverview.tsx`<br>`components/TabRequests.tsx`<br>`components/chat/ChatContainer.tsx`<br>`components/TabActivities.tsx` | `artifacts/api-server/src/routes/portal-auth.ts`<br>`artifacts/api-server/src/routes/portal-data.ts`<br>`artifacts/api-server/src/routes/portal-chat.ts`<br>`artifacts/api-server/src/routes/activities.ts`<br>`artifacts/api-server/src/routes/push-notifications.ts` | `profile_portal`<br>`portal_chat`<br>`portal_notifications`<br>`activities` |

---

## 5. Key Directory Map
- `CODEBASE_MAP.md`: Master architectural and component registry.
- `scripts/code-lookup.mjs`: CLI instant lookup command.
- `SYSTEM_DOCUMENTATION.md`: Full system documentation.
