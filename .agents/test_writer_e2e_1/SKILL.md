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

## 4. Key Directory & File Map
- `artifacts/housing/src/pages/`:
  - `housing/`: Room, building, floor, availability, and housekeeping tabs.
  - `profiles/`: Employee directory, vacation management, ID images.
  - `accommodation/`: `in-house.tsx`, `reservations/`, `guest-hosting/`, `history.tsx`.
  - `maintenance.tsx`: Work order tickets and technician assignment.
  - `settings/`: LookupSection, password policy, Hotek encoders, HR sync.
- `artifacts/api-server/src/`:
  - `routes/`: Express endpoint definitions.
  - `lib/migrations.ts`: Automatic startup migration runner.
  - `lib/pms-server.ts`: Hotek PMS TCP socket listener and card encoders.
- `lib/db/`:
  - `src/schema/`: Drizzle ORM table models.
  - `src/migrations/`: Master SQL migration script (`20260904_complete_schema_and_constraints.sql`).
- `SYSTEM_DOCUMENTATION.md`: Full architectural and historical documentation.
