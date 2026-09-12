# Sunrise Staff Housing Management — Architecture & Codebase Map

> **Purpose:** Instant navigation directory and architectural index for developers and AI agents.
> **Fast CLI Lookup:** Run `node scripts/code-lookup.mjs <feature-or-keyword>` to immediately locate relevant files, routes, components, and schemas in under 50ms.

---

## 1. Project Architecture & Monorepo Structure

```
final_project/
├── artifacts/
│   ├── housing/               # Main Admin & Staff Housing Web App (React 18 + Vite + TS + Tailwind)
│   ├── api-server/             # Backend REST & WebSocket Server (Node.js ESM + Express + Drizzle)
│   └── employee-portal/        # Resident Mobile PWA & Portal (React + Capacitor + Tailwind)
├── lib/
│   └── db/                    # Drizzle ORM Models, Migrations & PostgreSQL Connection Pool
├── scripts/
│   ├── code-lookup.mjs        # Instant feature & codebase lookup CLI tool
│   └── ...                    # SSL, health monitor, and migration utility scripts
├── AGENTS.md                  # System prompt instructions & instant feature matrix
└── SYSTEM_DOCUMENTATION.md    # In-depth architectural & historical specifications
```

---

## 2. Master Feature-to-File Matrix

| # | Feature / Module | UI URL & Entry Point | Frontend Component(s) | Backend Route(s) | Database Tables |
|---|---|---|---|---|---|
| **1** | **Reservations & Direct Check-in Wizard** | `/:property/accommodation/reservations` | `artifacts/housing/src/pages/accommodation/reservations/ReservationsPage.tsx` | `routes/reservations.ts`<br>`routes/assignments.ts` (lines 418-472)<br>`lib/cross-property-service.ts` | `reservations`<br>`assignments`<br>`profiles` |
| **2** | **In-House Occupants & Bed Transfers** | `/:property/accommodation/in-house` | `artifacts/housing/src/pages/accommodation/in-house.tsx`<br>*(Checkout Dialog, Transfer Bed Modal, Key Dialog)* | `routes/assignments.ts`<br>`routes/rooms.ts` | `assignments`<br>`rooms` |
| **3** | **Smart Room Assignment Recommender** | `/:property/accommodation/room-assignment` | `artifacts/housing/src/pages/accommodation/room-assignment.tsx`<br>*(Recommender Engine, Cross-Property Modal)* | `routes/assignments.ts`<br>`routes/rooms.ts` | `assignments`<br>`rooms` |
| **4** | **Accommodation History & Archives** | `/:property/accommodation/history` | `artifacts/housing/src/pages/accommodation/history.tsx`<br>*(Stay Logs, Checkout Reasons, Excel/PDF)* | `routes/assignments.ts` (`GET /history`) | `assignments` |
| **5** | **Guest Hosting & Family Visits** | `/:property/accommodation/guest-hosting`<br>`/:property/hosting-requests` | `artifacts/housing/src/pages/accommodation/guest-hosting/GuestHostingPage.tsx`<br>`src/pages/hosting-requests/*` | `routes/hostings.ts`<br>`routes/hosting-requests.ts` | `hostings`<br>`hosting_companions`<br>`family_visit` |
| **6** | **Housing: Buildings, Floors & Rooms** | `/:property/housing`<br>`/:property/room-space-view` | `pages/housing/HousingPage.tsx`<br>`components/buildings/*`<br>`components/floors/*`<br>`components/rooms/*`<br>`RoomSpaceViewTab.tsx` | `routes/buildings.ts`<br>`routes/floors.ts`<br>`routes/rooms.ts`<br>`routes/room-import.ts` | `buildings`<br>`floors`<br>`rooms` |
| **7** | **Room Amenities & Equipment Inventory** | `Housing -> Room Details`<br>`/:property/reports (Amenities Tab)` | `pages/housing/components/RoomDetailsDialog.tsx`<br>`pages/reports/components/AmenitiesInventoryTab.tsx` | `routes/room-inventory.ts` | `room_inventory` |
| **8** | **Housekeeping & Cleanliness Lifecycle** | `/:property/housekeeping`<br>`Housing -> Housekeeping Tab` | `pages/housekeeping/index.tsx`<br>`pages/housing/components/HousekeepingTab.tsx` | `routes/rooms.ts` (`clean-status`, `batch-clean`) | `rooms` (`cleanliness_status`) |
| **9** | **Profiles & Employee Directory** | `/:property/profiles`<br>`/:property/profiles/:id` | `pages/profiles/ProfilesPage.tsx`<br>`pages/profiles/detail.tsx`<br>`ProfileDialog.tsx`<br>`EditProfileDialog.tsx`<br>`ExcelImportDialog.tsx` | `routes/profiles.ts`<br>`routes/hr-sync.ts` | `profiles`<br>`documents`<br>`profile_portal` |
| **10** | **Maintenance & Work Order Tickets** | `/:property/maintenance`<br>`/:property/maintenance/:id` | `pages/maintenance.tsx`<br>`pages/maintenance-details.tsx` | `routes/maintenance.ts` | `maintenance_tickets` |
| **11** | **Users & Permission Matrix (RBAC)** | `/:property/users`<br>`/:property/users/:id` | `pages/users/index.tsx`<br>`pages/users/detail.tsx`<br>`PermissionMatrixCenter.tsx`<br>`PermissionMatrixDialog.tsx`<br>`CreateUserDialog.tsx`<br>`EditUserDialog.tsx`<br>`EditPropertiesDialog.tsx` | `routes/users.ts`<br>`routes/auth.ts`<br>`middlewares/permissions.js`<br>`routes/user-signature.ts` | `users`<br>`user_signatures`<br>`password_history` |
| **12** | **System Settings & Integrations** | `/:property/settings` | `pages/settings/index.tsx`<br>`LookupSection.tsx`<br>`DoorLocksSection.tsx`<br>`HrSyncSection.tsx`<br>`SecuritySettings.tsx`<br>`JobTitlesImportDialog.tsx` | `routes/settings.ts`<br>`routes/lookup_values.ts`<br>`routes/hotek-config.ts`<br>`routes/smart-lock.ts`<br>`routes/hr-sync.ts`<br>`lib/pms-server.ts` | `settings`<br>`lookup_values`<br>`hotek_encoders`<br>`hotek_settings` |
| **13** | **Multi-Property & Schema Isolation** | `/:property/*` & `/properties` | `context/PropertyContext.tsx`<br>`lib/property-slug.ts`<br>`pages/properties.tsx` | `routes/properties.ts`<br>`lib/db.ts` (`withTenant`)<br>`lib/migrations.ts` | `public.properties`<br>Tenant schemas (`taal_housing`, etc.) |
| **14** | **Dashboard & Operational Hub** | `/:property/dashboard` | `pages/dashboard.tsx`<br>`DailyOperationsHub.tsx`<br>`BuildingCapacityMatrix.tsx`<br>`HousekeepingPriorityQueue.tsx`<br>`DashboardAnalyticsDonut.tsx` | `routes/dashboard.ts` | Aggregates from `rooms`, `assignments`, `maintenance` |
| **15** | **Activity Log & Audit Trail** | `/:property/activity-log` | `pages/activity-log.tsx` | `routes/activity_logs.ts` | `activity_logs` |
| **16** | **Employee Portal (Resident Mobile App)** | `http://localhost:10000`<br>`artifacts/employee-portal` | `src/pages/dashboard.tsx`<br>`src/pages/login.tsx`<br>`src/pages/forgot-password.tsx`<br>`src/pages/request-details.tsx`<br>`TabOverview.tsx`<br>`TabRequests.tsx`<br>`TabDocuments.tsx`<br>`chat/ChatContainer.tsx`<br>`TabActivities.tsx`<br>`TabFood.tsx`<br>`TabTransport.tsx`<br>`TabPortalSettings.tsx` | `routes/portal-auth.ts`<br>`routes/portal-data.ts`<br>`routes/portal-chat.ts`<br>`routes/activities.ts`<br>`routes/push-notifications.ts` | `profile_portal`<br>`portal_chat`<br>`portal_notifications`<br>`activities` |

---

## 3. Core Business & Architecture Invariants

### A. Cross-Property Transfers & Profile Fate Choices
- When moving an employee from Hotel A to Hotel B (via Reservations, Room Assignment, or In-House Transfer):
  1. Frontend flags `isCrossProperty` if `sourcePropertyId !== currentProperty.id`.
  2. Frontend displays explicit Confirmation Modal asking the user:
     - **Option 1 (Archive):** Move to new property and archive/hide from old property (`archiveSourceProfile: true`).
     - **Option 2 (Keep Active):** Keep active in old property as well (`archiveSourceProfile: false`).
  3. API endpoint `POST /api/assignments` (in `assignments.ts` lines 418-472) copies the profile via `cross-property-service.ts`, terminates prior assignments (`checkoutPreviousAssignment: true`), and archives source profile if selected.

### B. Room Status Lifecycle
- `available` (clean & has beds)
- `occupied` (beds assigned)
- Check-out Action: Transitions room immediately to `dirty`, releases bed, decrements `current_occupancy`.
- Cleaning Action: Transitions room from `dirty` -> `available` (or `occupied_dirty` -> `occupied`).
- Maintenance: `out_of_service` or `out_of_order`.

### C. Multi-Tenant Search Path
- Every tenant database operation uses `withTenant(req)`.
- Database query runs under `SET search_path TO <tenant_schema>, public`.
- Global tables live in `public` (`properties`, `users`).
- Local hotel tables live in tenant schemas (`taal_housing`, `el_waha_new`, `elwaha_old`).

### D. Dual-Layer RBAC
- Frontend: Every action button, tab, or dialog trigger must be wrapped in `<PermissionGate module="..." action="...">`.
- Backend: Every API endpoint must have `requirePermission(module, action)` middleware.

---

## 4. Instant CLI Quick-Reference

Whenever you need to inspect or modify a feature without reading through files:

```bash
# General search
node scripts/code-lookup.mjs <term>

# Examples:
node scripts/code-lookup.mjs reservations       # Wizard, room selection, cross-property
node scripts/code-lookup.mjs in-house           # Occupants, check-out, transfers
node scripts/code-lookup.mjs profiles           # Directory, edit modal, excel import
node scripts/code-lookup.mjs maintenance        # Tickets, work orders, technicians
node scripts/code-lookup.mjs users              # Users, matrix, permissions
node scripts/code-lookup.mjs hotek              # Door locks, PMS encoder, socket server
node scripts/code-lookup.mjs portal             # Resident mobile app, chat, requests
node scripts/code-lookup.mjs inventory          # Amenities & room equipment inventory
node scripts/code-lookup.mjs --list             # List all 16 indexed modules
```
