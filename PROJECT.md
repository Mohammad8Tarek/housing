# Project: Sunrise Staff Housing & Employee Portal — Comprehensive Automated E2E Testing

## Architecture
The Sunrise Staff Housing Management System and Employee Portal is an enterprise hospitality staff housing solution built with React 18/19, Vite, TailwindCSS, Radix/Shadcn UI, TanStack Query v5, Express/Node.js, PostgreSQL 18 with multi-tenant schema isolation (public, taal_housing, el_waha_new, elwaha_old), Capacitor Android/Web portal, and Hotek PMS TCP lock socket integration (Port 10006).

This comprehensive testing and quality initiative establishes automated verification across:
1. **Housing Core UI & Button Interaction Suite (R1)**: Automated visiting and clicking of every button, action menu item, modal trigger, tab, dropdown, filter, debounced search bar, and pagination control across Dashboard, Housing, Housekeeping, Profiles, Accommodation, Maintenance, Users & Permissions, Settings, and Activity Log with a zero-uncaught-console-error sentinel.
2. **Dual-Layer RBAC & Permission Matrix Verification (R2)**: Automated verification of dual-layer access control: frontend <PermissionGate> hiding/disabling unauthorized controls and backend equirePermission returning HTTP 403 Forbidden across all 275 Express routes, 63 PermissionGate points, 9 system roles, and multi-tenant schema isolation boundaries.
3. **Employee Portal Comprehensive Flow Testing (R3)**: Automated testing of the Employee Portal (rtifacts/employee-portal/) covering auth guards, login, biometric fallback, maintenance request submission, request detail view, image zoom modal (resolving thumbnail click defect in equest-details.tsx), back navigation, and password updates.
4. **Zero-Data-Loss & Negative Boundary Assertions (R4)**: Execution of negative input boundaries, room lifecycle transitions, concurrency race conditions, idempotent schema migrations, and seeder safety assertions.
5. **Full System Health Report**: Aggregated execution report documenting pass/fail status, response latencies, and DOM interaction coverage.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Global Shell & Navigation Automation | Topbar controls (property switcher, notifications, language AR/EN, theme, profile menu, password change) with zero console errors | M1 | Survey R1 |
| 2 | Dashboard KPI & Widget Interaction | KPI metric spring cards, 7 Quick Access cards, Recharts chart tooltips, Departure Alerts, and Activity Stream | M1 | Survey R1 |
| 3 | Housing & Space View Interaction | 7 main tabs, Smart Building Generation wizard, Floor/Room CRUD modals, Bed space assign triggers, Bulk Room delete, Room Log | M1 | Survey R1 |
| 4 | Housekeeping & Key Management | Clean/dirty status transitions, Out of Service modal, Key card issuance panel, and Hotek TCP bridge connection handling | M1 | Survey R1 |
| 5 | Profiles Directory & ID Lightbox | 25-column chooser, table/grid views, Add/Edit Profile modal, Excel Import wizard, Document Lightbox, and Vacation management | M1 | Survey R1 |
| 6 | Accommodation & Reservation Workflows | In-House actions (checkout, transfer, extend, letter print), 3-step Reservation wizard, Guest Hosting companion builder, and History | M1 | Survey R1 |
| 7 | Maintenance Work Order Lifecycle | Category/status filters, New Ticket modal with photo attachment, live duration timer, technician assignment, and status updates | M1 | Survey R1 |
| 8 | Users & Permission Matrix UI | User CRUD modals, PasswordStrengthMeter, role tabs, action-aware search, bulk select/deselect, and role presets | M1 | Survey R1 |
| 9 | Settings & Activity Log UI | 7 settings tabs (Branding, Lookups CRUD, Security, HR Sync, Door Locks) and Activity Log JSON syntax viewer | M1 | Survey R1 |
| 10 | Frontend PermissionGate Matrix | 63 PermissionGate mount points systematically verified for hiding/disabling across all 9 roles | M2 | Survey R2 |
| 11 | Backend Route Permission Guard Matrix | 275 Express routes verified for requirePermission HTTP 403 enforcement against unauthorized roles | M2 | Survey R2 |
| 12 | Custom Permission Overrides & Safeguards | Dynamic inheritance ([]), zero permission (['none']), dot/colon normalization, and super_admin immunity verification | M2 | Survey R2 |
| 13 | Multi-Tenant Property Isolation | Strict schema containment (taal_housing, el_waha_new, elwaha_old), withTenant search_path clamping, and cross-property leak prevention | M2 | Survey R2 |
| 14 | Employee Portal Auth Guards & Login | Redirect unauthenticated users to /login, token storage, biometric fallback, and session persistence | M3 | Survey R3 |
| 15 | Portal Request Submission & Image Upload | Housing status view, maintenance request submission with photo preview, and request list view | M3 | Survey R3 |
| 16 | Portal Request Details & Image Zoom Modal | Request detail by ID, thumbnail onClick zoom activation (bug fix), lightbox modal, and back navigation | M3 | Survey R3 |
| 17 | Portal Password Update Flow | Password update form validation, current password check, bilingual toast feedback, and re-login | M3 | Survey R3 |
| 18 | Idempotent Migrations & Seeder Safety | Master SQL migration idempotency across all schemas, zero DROP TABLE in production, seeder safety check | M4 | Survey R4 |
| 19 | Room Lifecycle State Machine | available -> occupied -> dirty -> available, occupied_vacation, out_of_service, and entire_room booking isolation | M4 | Survey R4 |
| 20 | Concurrency & Race Condition Bounds | Concurrent bed check-ins, double booking prevention, and simultaneous checkout handling | M4 | Survey R4 |
| 21 | Negative Input Boundaries & Security | SQL injection, XSS payloads in notes/names, inverted date ranges, negative capacity, oversized payloads | M4 | Survey R4 |
| 22 | Automated Execution & Health Report | Unified test runner publishing TEST_READY.md, DOM coverage stats, response times, and zero-error health report | M4 | Survey/Spec |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Housing Core UI & Button Interaction Suite | Automated DOM visiting, clicking, modal triggering, pagination, debounced search, bilingual toasts, and zero console errors sentinel across all 8 modules + Shell | none | PLANNED |
| M2 | Dual-Layer RBAC & Permission Matrix Verification | Automated dual-layer RBAC matrix verification: frontend PermissionGate + backend requirePermission HTTP 403 across 275 routes, 63 UI gates, and multi-tenant schema isolation | none | PLANNED |
| M3 | Employee Portal Comprehensive Flow Testing | Automated testing of Employee Portal: auth guards, login, biometric fallback, maintenance request flow, request-details image zoom bug fix, back navigation, password update | none | PLANNED |
| M4 | Zero-Data-Loss, Negative Boundaries & Full Health Report | Migration idempotency, seeder guard, room lifecycle state transitions, concurrent race assertions, input boundary testing, unified test runner, and Full System Health Report | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### Test Suite Execution Contract
- All test suites must be executable from the workspace root via standard commands:
  `powershell
  # 1. Run Complete E2E & Domain Test Suite
  npm test
  # or
  node tests/run-all-tests.mjs
  `
- Exit code 0 indicates all assertions passed cleanly with 0 failures.
- Output includes structured JSON or Markdown summary of execution results, latency benchmarks, and assertion counts.

### Dual-Layer RBAC Contract
- Frontend: Elements wrapped in <PermissionGate module="X" action="Y"> MUST NOT be rendered or must be disabled when active user lacks permission.
- Backend: Endpoints guarded with equirePermission('X', 'Y') MUST return HTTP 403 Forbidden with { error: 'Forbidden', message: '...' } when requested without valid permission.
- Multi-Tenant: Requests with Property ID headers/cookies MUST ONLY access records within the tenant's isolated PostgreSQL schema (search_path).

### Employee Portal Contract
- Request Detail View: Clicking the photo thumbnail in equest-details.tsx must trigger setSelectedImage(photoUrl) and open the lightbox modal.
- Back Button: Clicking back navigation must navigate smoothly to /dashboard or previous screen without unhandled exceptions.

---

## Code Layout
- **Testing Infrastructure**:
  - 	ests/: Automated test suites and runners.
  - 	ests/e2e-housing-ui.test.mjs: Housing Core UI & button interaction test suite (M1).
  - 	ests/e2e-rbac-matrix.test.mjs: Dual-layer RBAC & multi-tenant isolation test suite (M2).
  - 	ests/e2e-employee-portal.test.mjs: Employee Portal complete flow & image zoom test suite (M3).
  - 	ests/e2e-zero-data-loss-boundaries.test.mjs: Zero-data-loss, room lifecycle, and negative boundaries suite (M4).
  - 	ests/run-all-tests.mjs: Master test aggregator and health report generator.
- **Frontend Code**:
  - rtifacts/housing/src/: Housing web application.
  - rtifacts/employee-portal/src/: Employee Portal web & mobile application.
- **Backend Code**:
  - rtifacts/api-server/src/: API server and routes.
- **Database Code**:
  - lib/db/: Schemas, migrations, and run-migration runner.
