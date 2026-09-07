# Survey & Architecture Report: Requirement R2 (Interactive Permission Matrix & Center Redesign)

**Author:** Permission Matrix Architecture Specialist  
**Date:** 2026-09-07  
**Working Directory:** `e:\lab\Sunrise-Housing-FULL\final_project\.agents\explorer_survey_permissions_1`  
**Target Requirement:** R2 (Interactive Permission Matrix & Center Redesign) from `ORIGINAL_REQUEST.md`  
**Handoff Type:** Hard (Survey Phase Complete)

---

## 1. Observations

### 1.1 Existing Component Codebases & Line References

#### A. `PermissionMatrixDialog.tsx`
- **Location:** `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx` (664 lines)
- **Role:** Modal dialog triggered from user list table actions (`UsersPage`, lines 343, 1069, 1148, 1178).
- **Initial Permission Computation (lines 59–73):**
  ```typescript
  const initialPerms = (): Set<string> => {
    const explicit = (user.permissions as string[] | undefined) ?? [];
    if (explicit.length > 0) {
      if (explicit.length === 1 && explicit[0] === "none") return new Set();
      const normalized = explicit.map((p) => {
        let s = String(p).trim().toLowerCase();
        if (s.startsWith("employees.")) s = s.replace("employees.", "profiles.");
        if (s.startsWith("employees:")) s = s.replace("employees:", "profiles:");
        return s;
      });
      return new Set(normalized);
    }
    const role = user.roles?.[0]?.toLowerCase() ?? "";
    return new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
  };
  ```
- **Action Dependency Enforcement (lines 101–122):**
  Auto-links `view` with operational sub-actions: disabling `view` clears all actions for that module; enabling any sub-action forces `view` on.
- **Save Payload (lines 173–180):**
  ```typescript
  const save = () => {
    setSaving(true);
    const toSave = Array.from(perms);
    updateMutation.mutate({
      id: user.id,
      data: { permissions: toSave.length === 0 ? ["none"] : toSave },
    });
  };
  ```
  Note: When all permissions are unchecked, `["none"]` is sent so the backend distinguishes "intentionally zero permissions" from "no custom permissions set (fallback to role defaults)".
- **Search Filtering Defect (lines 210–231):**
  ```typescript
  const matchingModules = group.modules.filter((m) => {
    if (!query) return true;
    const enLabel = (MODULE_LABELS[m]?.en || m).toLowerCase();
    const arLabel = (MODULE_LABELS[m]?.ar || "").toLowerCase();
    return enLabel.includes(query) || arLabel.includes(query) || m.includes(query);
  });
  ```
  **Direct Observation:** Search only tests module labels and keys. Typing action names like `delete`, `export`, `حذف`, `تصدير`, or `single_occupancy` yields 0 results.

#### B. `PermissionMatrixCenter.tsx`
- **Location:** `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx` (875 lines)
- **Role:** Dedicated full-tab view (`activeMainTab === "matrix"`) inside `UsersPage` (lines 460–467).
- **User Selector (lines 419–443):**
  Uses standard Radix `<Select>` without input filtering:
  ```tsx
  <SelectContent className="max-h-72">
    {users.map((u) => (
      <SelectItem key={u.id} value={String(u.id)}>
        {u.username} ({u.roles?.[0] || "user"})
      </SelectItem>
    ))}
  </SelectContent>
  ```
  When user lists grow beyond 20–50 accounts, selecting a specific user requires scrolling through a long unsearchable dropdown.
- **Visual Distinction Missing:**
  Every toggle switch displays identically (lines 809–816). There are no badges or indicators showing whether an action is active due to the user's role or because of an explicit custom grant.
- **No Revert to Role Inheritance:**
  `resetToStored()` (line 237) only resets unsaved changes to the currently stored `activeUser.permissions`. Neither the Dialog nor the Center has a button to clear custom overrides back to `[]` (dynamic role inheritance).

#### C. Backend RBAC Middleware & Security Enforcement
- **Location:** `artifacts/api-server/src/middlewares/permissions.ts` (525 lines)
- **Strict Override Evaluation (lines 303–356):**
  ```typescript
  function effectivePermissions(user: AuthUser): Set<string> {
    // 1. Explicit permissions configured:
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      const permissions = new Set<string>();
      for (const permission of user.permissions) {
        if (permission === "none") continue;
        const norm = normalize(permission);
        if (norm) {
          permissions.add(norm);
          if (norm.includes(".")) permissions.add(norm.replace(".", ":"));
          if (norm.includes(":")) permissions.add(norm.replace(":", "."));
        }
      }
      if (user.isSystemAdmin || user.roles.includes("super_admin") || user.roles.includes("system_admin")) {
        permissions.add("users.view");
        permissions.add("users.manage_permissions");
      }
      return permissions;
    }
    // 2. System admin fallback:
    if (user.isSystemAdmin || user.roles.includes("super_admin") || user.roles.includes("system_admin")) {
      return new Set(["*"]);
    }
    // 3. Role default fallback for users with empty permissions array:
    const permissions = new Set<string>();
    const resolvedRoles = resolveInheritedRoles(user.roles);
    for (const role of resolvedRoles) {
      for (const permission of ROLE_DEFAULT_PERMISSIONS[role] ?? []) {
        // ... adds role defaults
      }
    }
    return permissions;
  }
  ```
- **Permission Key Check (lines 358–366):**
  `hasPermission` checks both `module.action` and `module:action`.
- **Route Guards:**
  Routes are protected with `requirePermission(module, action)` and `requireAnyPermission([...])`.

#### D. Database Schema & Persistence
- **Location:** `lib/db/src/schema/users.ts` (lines 6–44)
- **Table Definition:**
  ```typescript
  export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    roles: text("roles").array().notNull().default([]),
    permissions: text("permissions").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    propertyIds: integer("property_ids").array().notNull().default([]),
    // ...
  });
  ```
  `permissions` is a native PostgreSQL `text[]` column.
- **Direct Database Query Verification:**
  Querying the database via `node -e` confirmed all 5 existing users in `public.users` have populated `permissions` arrays:
  - User `ahmed` (manager): 100 permissions
  - User `hr.wh` (receptionist): 36 permissions
  - User `admin` (super_admin, admin): 119 permissions
  - User `mohamed.fathy` (admin): 40 permissions
  - User `mohamed` (admin): 103 permissions

#### E. Critical Flaw Discovered in `EditUserDialog.tsx`
- **Location:** `artifacts/housing/src/pages/users/components/EditUserDialog.tsx` (line 149)
- **Code:**
  ```typescript
  const save = async () => {
    // ...
    const resolvedRoles = [formData.role].filter(Boolean);
    await updateMutation.mutateAsync({
      id: user.id,
      data: {
        username: formData.username,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        status: formData.status,
        roles: resolvedRoles,
        jobTitle: formData.jobTitle === "none" ? null : formData.jobTitle,
        permissions: getPermissionsForRoles(resolvedRoles), // <--- CRITICAL BUG
      } as any,
    });
  };
  ```
  **Direct Observation:** When an administrator edits basic profile details (e.g. phone number or email) of any user in `EditUserDialog`, line 149 recomputes `getPermissionsForRoles(resolvedRoles)` and overwrites `user.permissions`. Any custom permissions previously assigned to that user in `PermissionMatrixCenter` or `PermissionMatrixDialog` are silently wiped out.

---

## 2. Wire & Storage Formats

| Attribute | Specification | Notes |
|---|---|---|
| **Database Type** | PostgreSQL `text[]` (`permissions` column in `users` table) | Managed via Drizzle ORM |
| **API Wire Format** | `JSON { permissions: string[] }` | Sent in `POST /api/users` and `PATCH /api/users/:id` |
| **Canonical Notation** | `module.action` (dot notation, lowercase) | Defined by `permKey(m, a)` in `lib/permissions.ts` |
| **Legacy/Compat Format** | `module:action` (colon notation) | Accepted by backend `permissions.ts` and `use-permission.ts` |
| **Legacy Prefix Alias** | `employees.` / `employees:` | Auto-normalized to `profiles.` / `profiles:` on load |
| **Role Fallback State** | `permissions: []` (empty array) | User dynamically resolves all permissions from `roles` |
| **Zero Permission State** | `permissions: ["none"]` | Explicitly blocks all access without falling back to role |
| **Custom Overrides State** | `permissions: ["module.action", ...]` | Strict replacement: role defaults are completely superseded |

---

## 3. Comprehensive Inventory of Modules, Actions, and Groups

### 3.1 Logical Permission Groups (5 Groups)
From `PERMISSION_GROUPS` in `artifacts/housing/src/lib/permissions.ts`:

1. **`daily_operations` (التشغيل اليومي):**
   - Modules: `dashboard`, `housing`, `housekeeping`, `maintenance` (4 modules)
2. **`accommodation_flow` (مسار التسكين):**
   - Modules: `profiles`, `accommodation`, `reservations`, `guest_hosting`, `hosting_requests` (5 modules)
3. **`employee_portal` (بوابة الموظف):**
   - Modules: `portal_content`, `activities`, `documents`, `surveys`, `communications` (5 modules)
4. **`management` (الإدارة):**
   - Modules: `reports`, `evaluations`, `billing`, `settings`, `properties` (5 modules)
5. **`security` (الأمان والتدقيق):**
   - Modules: `users`, `activity_log`, `smart_locks` (3 modules)

### 3.2 System Actions (20 Actions)
`view`, `create`, `edit`, `delete`, `export`, `bulk_delete`, `bulk_export`, `assign`, `checkin`, `checkout`, `approve`, `transfer`, `reset_password`, `manage_permissions`, `view_sensitive`, `audit`, `publish`, `archive`, `unlock`, `override_single_occupancy`.

### 3.3 Complete Matrix of 22 Modules with Granular Actions (119 Total)

| # | Module Key | English Label | Arabic Label | Granular Actions | Count |
|---|---|---|---|---|---|
| 1 | `dashboard` | Dashboard | لوحة القيادة | `view`, `export` *(Note: backend checks `audit` at `/dashboard/all-stats`)* | 2 |
| 2 | `housing` | Housing & Rooms | الإسكان والغرف | `view`, `create`, `edit`, `delete`, `export`, `bulk_export` | 6 |
| 3 | `housekeeping` | Housekeeping | خدمات النظافة والترتيب | `view`, `edit`, `assign`, `approve`, `bulk_export` | 5 |
| 4 | `profiles` | Profiles & Employees | الملفات الشخصية والموظفون | `view`, `create`, `edit`, `delete`, `export`, `reset_password`, `manage_permissions`, `view_sensitive` | 8 |
| 5 | `accommodation` | In-House Accommodation | التسكين والمقيمون حالياً | `view`, `create`, `edit`, `delete`, `assign`, `checkin`, `checkout`, `approve`, `transfer`, `bulk_delete`, `bulk_export`, `archive`, `override_single_occupancy` | 13 |
| 6 | `reservations` | Reservations | الحجوزات | `view`, `create`, `edit`, `checkin`, `checkout`, `approve`, `bulk_export`, `archive`, `override_single_occupancy` *(Note: backend checks `delete` at `DELETE /reservations/:id`)* | 9 |
| 7 | `maintenance` | Tickets & Maintenance | التذاكر وبلاغات الصيانة | `view`, `create`, `edit`, `assign`, `approve`, `bulk_export`, `archive` *(Note: backend checks `delete` at `DELETE /maintenance/:id`)* | 7 |
| 8 | `reports` | Reports & Stats | التقارير والإحصائيات | `view`, `export`, `audit` | 3 |
| 9 | `users` | Users & Permissions | المستخدمين والصلاحيات | `view`, `create`, `edit`, `delete`, `manage_permissions`, `reset_password`, `unlock` | 7 |
| 10 | `settings` | System Settings | إعدادات النظام | `view`, `create`, `edit`, `delete` | 4 |
| 11 | `activity_log` | Activity Log & Audit | سجل النشاط والعمليات | `view`, `export`, `audit` | 3 |
| 12 | `properties` | Properties & Hotels | العقارات والفروع | `view`, `create`, `edit`, `delete` *(Restricted to Super Admin)* | 4 |
| 13 | `documents` | Documents | المستندات | `view`, `create`, `edit`, `delete`, `publish`, `archive` | 6 |
| 14 | `billing` | Billing | الفواتير | `view`, `export` | 2 |
| 15 | `communications` | Communications | الاتصالات | `view`, `create` | 2 |
| 16 | `evaluations` | Evaluations | التقييمات | `view`, `create`, `edit`, `delete`, `export` | 5 |
| 17 | `surveys` | Surveys | الاستبيانات | `view`, `create`, `edit`, `delete` | 4 |
| 18 | `portal_content` | Employee Portal | بوابة الموظف | `view`, `create`, `edit`, `delete` | 4 |
| 19 | `activities` | Portal Activities | أنشطة البوابة | `view`, `create`, `edit`, `delete`, `publish` | 5 |
| 20 | `smart_locks` | Smart Locks | الأقفال الذكية | `view`, `create`, `edit`, `delete` | 4 |
| 21 | `hosting_requests` | Hosting Requests | طلبات الاستضافة | `view`, `create`, `edit`, `delete`, `approve` | 5 |
| 22 | `guest_hosting` | Guest Housing | تسكين الاستضافات | `view`, `create`, `edit`, `delete`, `checkin`, `checkout`, `approve`, `transfer`, `export`, `bulk_export`, `bulk_delete` | 11 |
| **Total** | **22 Modules** | — | — | — | **119 Perms** |

### 3.4 Discrepancy Analysis (Frontend Definitions vs Backend Enforcement)
1. **`dashboard.audit`:** Backend route `GET /dashboard/all-stats` (line 51 of `routes/dashboard.ts`) enforces `requirePermission("dashboard", "audit")`, but `MODULE_ACTIONS.dashboard` in `lib/permissions.ts` only contains `["view", "export"]`.
2. **`reservations.delete`:** Backend route `DELETE /reservations/:id` (line 240 of `routes/reservations.ts`) enforces `requirePermission("reservations", "delete")`, but `MODULE_ACTIONS.reservations` omits `"delete"`.
3. **`maintenance.delete`:** Backend route `DELETE /maintenance/:id` (line 353 of `routes/maintenance.ts`) enforces `requirePermission("maintenance", "delete")`, but `MODULE_ACTIONS.maintenance` omits `"delete"`.
*Recommendation:* Synchronize `MODULE_ACTIONS` in `artifacts/housing/src/lib/permissions.ts` to include these actions so administrators can grant/revoke them via the matrix UI.

---

## 4. Baseline Role Permission Presets & Hierarchy

### 4.1 Role Hierarchy & Inheritance
Defined in `artifacts/housing/src/hooks/use-permission.ts` (lines 20–30) and `artifacts/api-server/src/middlewares/permissions.ts` (lines 85–95):
- `manager` inherits from `receptionist`.
- All other roles have direct flat baseline sets.

### 4.2 Full Preset Inventory in `ROLE_DEFAULT_PERMISSIONS`

| Role Identifier | Display Label (EN / AR) | Baseline Permissions Count | Primary Scope |
|---|---|---|---|
| `super_admin` | Super Admin / مدير النظام العام | 119 (100%) | Global access including property tenant administration. |
| `system_admin` | System Admin / مدير النظام التقني | 119 (100%) | Full system access. |
| `admin` | Property Admin / مدير النظام | 115 (96.6%) | All modules except `properties` + `users.unlock`. |
| `manager` | Property Manager / مدير المجمع | 62 (52.1%) | Operations, accommodation, reservations, tickets, reports, user viewing, settings. |
| `receptionist` | Receptionist / موظف استقبال | 33 (27.7%) | Check-in, check-out, accommodation viewing, guest hosting, ticket creation. |
| `maintenance_staff` | Maintenance Staff / موظف صيانة | 13 (10.9%) | Housing viewing, housekeeping view/edit, ticket management. |
| `hr_admin` | HR Admin / مسؤول الموارد البشرية | 32 (26.9%) | Profiles, evaluations, surveys, activities, communications, reports. |
| `portal_admin` | Portal Admin / مسؤول البوابة | 16 (13.4%) | Portal content, activities, communications, documents, reports. |
| `security_staff` | Security Staff / موظف أمن | 9 (7.6%) | Housing view, accommodation view, smart locks full control. |

### 4.3 UI Preset Button Gap
In both `PermissionMatrixDialog.tsx` (lines 306–316) and `PermissionMatrixCenter.tsx` (lines 499–514), the preset buttons are rendered via `SYSTEM_ROLES.map(...)` from `../utils`.
`SYSTEM_ROLES` only defines 5 roles (`super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff`).
Roles `hr_admin`, `portal_admin`, and `security_staff` are completely absent from the preset toolbar, even though their baseline permission arrays already exist in `ROLE_DEFAULT_PERMISSIONS`.

---

## 5. Evaluation of Current Matrix UX & Deficiencies

### 5.1 Real-Time Bilingual Search Deficiencies
- **Current Behavior:** Search input matches only `MODULE_LABELS[m].en`, `MODULE_LABELS[m].ar`, and module key string `m`.
- **User Impact:** Searching for specific operations like "حذف" (delete), "تصدير" (export), "اعتماد" (approve), "override", "single_occupancy", or "unlock" returns empty results.
- **Requirement R2 Violation:** The specification states: *"Include a quick real-time search bar to filter permissions by action or module keyword in both Arabic and English."*

### 5.2 Visual Distinction (Baseline Role vs Custom Override)
- **Current Behavior:** Missing entirely.
- **User Impact:**
  - An administrator viewing a `receptionist` cannot distinguish whether `housing.edit` is enabled because it was granted as a custom exception or if it is part of their regular role duties.
  - Revoked role defaults are completely invisible (simply show as unchecked switches).
  - The UI does not provide summary diff indicators (e.g. "+3 custom grants", "-1 revoked").

### 5.3 Bulk Toggle Controls
- **Current Controls:**
  - "Select All" (sets all 119 permissions).
  - "Clear All" (sets 0 permissions, writes `["none"]`).
  - "Read Only" (sets `view` on all 22 modules).
  - Module Master Switch (toggles all actions of a single module).
- **Missing Capabilities:**
  - Category/Group-level bulk actions (e.g. "Select All in Daily Operations").
  - Column/Action bulk actions (e.g. "Grant View across All", "Revoke Delete across All").
  - "Revert to Role Inheritance" action (resets `permissions` to `[]`, removing custom overrides).

### 5.4 Scale & Ergonomics in `PermissionMatrixCenter`
- In `PermissionMatrixCenter.tsx`, the user selector is a simple `<SelectContent className="max-h-72">`. For properties with 50+ users, navigating to a specific user requires scanning an unsearchable select menu.
- The 22-module card grid requires extensive vertical scrolling. An optional compact spreadsheet/matrix table view is needed.

---

## 6. Concrete Architectural Recommendations

### 6.1 Unified Diff & State Engine
Both `PermissionMatrixDialog` and `PermissionMatrixCenter` should share a computed state structure:

```typescript
export interface PermissionDiffSummary {
  baseRolePerms: Set<string>;
  activePerms: Set<string>;
  customAdded: Set<string>;    // in activePerms but NOT in baseRolePerms
  customRevoked: Set<string>;  // in baseRolePerms but NOT in activePerms
  isInheritingRole: boolean;   // activePerms matches baseRolePerms exactly
}
```

- **Permission Item Visual States:**
  1. **`role-default` (افتراضي للدور):** Checked switch + muted badge `Role Default` (Blue/Slate).
  2. **`custom-grant` (منح مخصص):** Checked switch + glowing badge `+ Custom` (Emerald/Amber with Sparkles icon).
  3. **`custom-revoked` (ملغي من الدور):** Unchecked switch + subtle warning badge `- Revoked` (Rose outline with Tooltip: "Normally granted by role").
  4. **`disabled`:** Unchecked switch.

### 6.2 Action-Aware Bilingual Search Filter
Expand the search filter to test both module metadata AND individual action metadata:
```typescript
const isActionMatch = (a: Action, query: string) => {
  const q = query.trim().toLowerCase();
  const en = (ACTION_LABELS[a]?.en || a).toLowerCase();
  const ar = (ACTION_LABELS[a]?.ar || "").toLowerCase();
  return en.includes(q) || ar.includes(q) || a.toLowerCase().includes(q);
};
```
When an action keyword matches, the module expands and matching action cards/switches receive a visual highlight border (`ring-2 ring-primary/40`).

### 6.3 Comprehensive Role Presets
Expand preset pills to cover all 9 system roles:
`super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff`, `hr_admin`, `portal_admin`, `security_staff`, plus `Read-Only All`.

### 6.4 "Revert to Role Inheritance" Action
Provide a dedicated button:
- **Button:** "Revert to Role Defaults" / "استعادة صلاحيات الدور الافتراضية"
- **Behavior:**
  - Resets `perms` to `baseRolePerms`.
  - Sets a flag to submit `permissions: []` on save, freeing the user from static custom overrides.

### 6.5 Dual-View Mode in `PermissionMatrixCenter`
Introduce a View Mode toggle in the Center toolbar:
1. **Interactive Matrix Table View (Spreadsheet Style):**
   - Rows: 22 Modules grouped by Category.
   - Standard Columns: View, Create, Edit, Delete, Export, Approve, Special.
   - Cells: Interactive checkbox/switch with tooltip indicating role vs custom state.
   - Header Bulk Actions: Click column header to toggle that action across all visible modules.
2. **Card Grid View (Visual Cards):**
   - Elevated cards with clear section headers, progress counters, master switches, and grouped action pills.

### 6.6 Searchable User Combobox in `PermissionMatrixCenter`
Replace the native `<Select>` with a searchable Radix Popover/Command combobox displaying:
- Avatar / User initials.
- Username and full name/job title.
- Role badge with color coding (`roleColor`).
- Custom permissions count badge (`+X custom`).

### 6.7 Safety Fix for `EditUserDialog.tsx`
In `artifacts/housing/src/pages/users/components/EditUserDialog.tsx`, line 149 must be updated so editing profile details does not overwrite existing custom permissions:
```typescript
// Proposed fix in EditUserDialog.tsx:
permissions: user.permissions && user.permissions.length > 0 ? user.permissions : getPermissionsForRoles(resolvedRoles)
```

---

## 7. Logic Chain

1. **Premise:** Requirement R2 mandates a modern, interactive Permission Matrix Center and Dialog with logical grouping, bulk toggle actions, real-time bilingual search by action or module keyword, and visual distinction between baseline role permissions and custom grants.
2. **Observation:**
   - Both `PermissionMatrixDialog.tsx` and `PermissionMatrixCenter.tsx` load and save `module.action` string arrays.
   - Neither component differentiates role-inherited permissions from custom grants.
   - The search filter only checks module labels and completely ignores action keywords.
   - `EditUserDialog.tsx` line 149 clobbers custom permissions on any profile update.
   - Preset buttons omit 3 valid roles (`hr_admin`, `portal_admin`, `security_staff`).
3. **Deduction:** Redesigning both components requires implementing an active diff calculation engine (`roleBaseline` vs `activePerms`), updating the search algorithm to index actions bilingually, adding group/column bulk toggles, introducing a dual-mode layout (Matrix Table + Card Grid) in the Center, and fixing the destructive save pattern in `EditUserDialog.tsx`.
4. **Conclusion:** The survey has uncovered all technical requirements, schemas, discrepancies, and architecture patterns necessary for an immediate, high-quality implementation in Phase 2.

---

## 8. Caveats

- **No Caveats.** All source files, schemas, and routes were directly inspected and verified against running PostgreSQL 18 data and production build commands.

---

## 9. Verification Method

To verify these findings:

1. **Verify Frontend Build:**
   ```bash
   cd artifacts/housing
   npm run build
   ```
   *Result:* Exits with code 0 (verified).

2. **Verify API Server Build:**
   ```bash
   cd artifacts/api-server
   npm run build
   ```
   *Result:* Exits with code 0 (verified).

3. **Verify Database Permission Records:**
   ```bash
   node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgresql://postgres:admin123@localhost:5432/staff-housing' }); pool.query('SELECT id, username, roles, array_length(permissions, 1) as count FROM users').then(r => { console.table(r.rows); pool.end(); });"
   ```
   *Result:* Displays all users with active `permissions` arrays.

4. **Inspect Key File Locations:**
   - `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx` (lines 59–73, 173–180, 210–231)
   - `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx` (lines 108–125, 419–443, 809–816)
   - `artifacts/housing/src/lib/permissions.ts` (lines 3–26, 75–159, 201–369, 513–576)
   - `artifacts/housing/src/pages/users/components/EditUserDialog.tsx` (line 149)
   - `artifacts/api-server/src/middlewares/permissions.ts` (lines 5–51, 108–258, 303–356)
