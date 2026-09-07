# Design System & API Contracts Survey Report

**Author**: Design System & API Contracts Miner (`spec_miner_survey_design_api_1`)  
**Timestamp**: 2026-09-07T15:55:00Z  
**Context**: Comprehensive baseline survey of build health, design system components, Tailwind tokens, RTL/LTR patterns, users & permissions API contracts, and requirements verification mapping for the Sunrise Housing User Management and Permission Matrix elevation.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Build Baseline | Frontend Build Baseline | Production Vite + React 18 build in `artifacts/housing` | `npm run build` | Exit Code 0, built in 21.20s, bundle output in `dist/public` | Rollup / PostCSS / TypeScript compilation errors | CLI execution |
| 2 | Build Baseline | API Server Build Baseline | Production Node.js build in `artifacts/api-server` | `npm run build` | Exit Code 0, built in 511ms, output in `dist/` | ESBuild / module bundling errors | CLI execution |
| 3 | UI Components | Modal Dialog Foundation | Radix UI Dialog primitives wrapped in `dialog.tsx` with max-height fix, accessible sr-only title/description, portal, overlay, and scrollable content | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` | Rendered modal overlay & card with smooth zoom/fade animations | Throws accessibility console error if DialogTitle missing (covered by fallback srTitle) | `artifacts/housing/src/components/ui/dialog.tsx` |
| 4 | UI Components | Side Drawer / Sheet | Radix UI Sheet component for slide-out drawers | `SheetContent` with `side: "right" \| "left" \| "top" \| "bottom"` | Slide-out overlay & container | None | `artifacts/housing/src/components/ui/sheet.tsx` |
| 5 | UI Components | Tabs Navigation | Radix Tabs for module switching or mode toggle | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Styled active/inactive tab buttons with data-state | Missing active value defaults to first | `artifacts/housing/src/components/ui/tabs.tsx` |
| 6 | UI Components | Form Controls & Badges | Shadcn Button, Badge, Input, Switch, Checkbox, Select, Tooltip, ScrollArea | Form control props (`checked`, `value`, `onChange`, `variant`) | Styled interactive elements supporting dark/light mode | Standard disabled states, pointer-events-none | `artifacts/housing/src/components/ui/*` |
| 7 | Design Tokens | Brand Theme & Palette | Primary Gold (`#C9A24D` / `hsl(41 56% 54%)`), Sidebar Navy (`#0F2A44` / `hsl(209 64% 16%)`), Card/Popover HSL tokens, glassmorphism `.glass-effect` | Tailwind utility classes & CSS variables | Consistent brand styling across dark and light modes | Invalid class fails silently to default | `artifacts/housing/src/index.css` |
| 8 | Typography & Fonts | Bilingual Typography | Arabic uses `Cairo`, English uses `Inter`, code uses `JetBrains Mono`. Global rule: `[dir="rtl"], [dir="rtl"] * { font-family: "Cairo", sans-serif; }` | `dir="rtl"` or `dir="ltr"` attribute on root/container | Applied font family and font feature settings | Unset font falls back to system sans-serif | `artifacts/housing/src/index.css` |
| 9 | Bilingual Layout | RTL Direction Helpers | Directional utilities `rtl:space-x-reverse`, `gap-*`, `rtl:rotate-180` (for Chevrons), `pl-9 rtl:pr-9 rtl:pl-3` (for search input icons), `ml-auto rtl:ml-0 rtl:mr-auto` (badges) | `const ar = language === "ar"` via `useLanguage()` | Mirrored layouts, aligned icons, correct text direction | Text overflow if layout is fixed width without truncation | `artifacts/housing/src/context/LanguageContext.tsx` & page grep |
| 10 | API: Users | List Users Endpoint | `GET /api/users` with server-side pagination (`page`, `limit`), `search`, `role`, `status` filters, and system overview summary | Query params: `page`, `limit`, `search`, `role`, `status` | `{ data: User[], pagination: { page, limit, total, totalPages }, summary }` | 401 Unauthorized, 403 Forbidden | `artifacts/api-server/src/routes/users.ts:70-258` |
| 11 | API: Users | Get Single User | `GET /api/users/:id` | Path param `id: number` | Full user object without password hash | 400 Invalid ID, 404 User not found | `artifacts/api-server/src/routes/users.ts:260-317` |
| 12 | API: Users | Create User Endpoint | `POST /api/users` creating new user, verifying password against tenant password policy, hashing password via bcrypt, assigning multiple property IDs | JSON body: `propertyId`, `propertyIds`, `username`, `password`, `roles`, `permissions`, `jobTitle`, `email`, `phone`, `status` | 201 Created with sanitized user object | 400 Bad Request (`CreateUserBody` Zod schema error, or password policy failure: `"Password must be at least 8 characters; ..."`), 403 Forbidden (non-admin creating admin) | `artifacts/api-server/src/routes/users.ts:320-390` |
| 13 | API: Users | Update User Endpoint | `PATCH /api/users/:id` updating profile, roles, permissions, properties, or password. Updates `property_ids` array in PostgreSQL. Detailed activity audit log | Path param `id`, JSON body: `username`, `email`, `phone`, `roles`, `permissions`, `status`, `password`, `jobTitle`, `propertyIds`, `propertyId` | 200 OK with updated user fields | 400 Bad Request, 403 Permission denied, 404 User not found | `artifacts/api-server/src/routes/users.ts:393-543` |
| 14 | API: Users | Unlock User Account | `POST /api/users/:id/unlock` clearing failed attempts and lock time | Path param `id` | `{ success: true, message }` | 400 Invalid ID, 403 Forbidden, 404 Not Found | `artifacts/api-server/src/routes/users.ts:547-597` |
| 15 | API: Users | Delete User Endpoint | `DELETE /api/users/:id` preventing self-deletion, cleaning foreign key relations (signatures, history, approvals) in transaction | Path param `id` | 204 No Content | 400 Attempting to delete own user, 403 Cannot delete system admin, 500 DB constraint | `artifacts/api-server/src/routes/users.ts:599-694` |
| 16 | API: Signatures | User Signature API | `GET /api/users/:id/signature` and `POST /api/users/:id/signature` | User ID, base64 data string | `{ signatureImageUrl, uploadedAt }` | 400 Invalid payload, 403 Unauthorized | `artifacts/housing/src/pages/users/components/EditUserDialog.tsx:35-130` |
| 17 | RBAC Engine | Permission Matrix Definition | 22 modules, 20 actions, grouped into 5 operational domains (`daily_operations`, `accommodation_flow`, `employee_portal`, `management`, `security`) | Module & Action strings, formatted as `${module}.${action}` | Resolved permission keys array | Unrecognized module throws or is ignored | `artifacts/housing/src/lib/permissions.ts` |
| 18 | RBAC Engine | Dual-Layer Enforcement | Frontend `<PermissionGate module action>` + Backend `requirePermission(module, action)`. Supports dot and colon syntax (`module.action`, `module:action`) | Current user session roles & permissions | Allows or denies action rendering or route execution | Frontend renders null/fallback; backend returns 403 Forbidden | `artifacts/api-server/src/middlewares/permissions.ts` & `permission-gate.tsx` |
| 19 | RBAC Engine | Explicit Permissions Flag | Distinguishes between role defaults and custom override. If explicit permissions are empty, sent as `["none"]` to prevent falling back to defaults | Array of strings (`["none"]` or `["module.action", ...]`) | Exact granted permissions set | If empty array is saved, app may fall back to role default unless `["none"]` is used | `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx:59-73` |
| 20 | Query Cache | Cache Invalidation Keys | TanStack Query cache invalidation triggers after mutations | `getListUsersQueryKey()`, `getGetMeQueryKey()`, `["user-signature", userId]` | Auto-refetches active user lists and session state | Stale cache if keys omitted | `artifacts/housing/src/pages/users/components/*` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | User Creation | Short password (< 8 characters, e.g. "123456") | Backend `validatePassword()` returns 400 Bad Request with semicolon-delimited error: `"Password must be at least 8 characters; Password must contain an uppercase letter"`. Frontend currently only had placeholder stating 6 chars, creating a validation mismatch. |
| 2 | User Creation | Duplicate username | Backend checks uniqueness in `usersTable` and returns HTTP 400 with `{ error: "Username already exists" }`. |
| 3 | Role Assignment | Non-system admin tries to create or grant `super_admin` or `admin` role | Backend `isSystemAdminRoles()` guard rejects with HTTP 403: `{ error: "Only system admins can create system admins" }` or `{ error: "Only system admins can grant system-admin roles" }`. |
| 4 | User Deletion | Current logged-in user tries to delete their own account | Backend rejects with HTTP 400: `{ error: "لا يمكنك حذف حسابك الشخصي المسجل به حالياً", errorEn: "You cannot delete your currently logged-in account" }`. |
| 5 | Property Multi-Select | User assigned to multiple properties with primary property | Backend accepts `propertyIds: number[]` and `propertyId: number`, saves array via PostgreSQL array literal `UPDATE users SET property_ids = $1, property_id = $2 WHERE id = $3`. Non-super_admin users without any property selected fail validation: `"Please select at least one property"`. |
| 6 | Permission Matrix | All permissions deselected for a user | Frontend sends `data: { permissions: ["none"] }`. Backend persists `["none"]`. The permission evaluator (`usePermission.ts`) interprets `["none"]` as an explicit zero-permission user, preventing automatic fallback to role baseline defaults. |
| 7 | Action Dependency | Disabling `view` on any module | In `PermissionMatrixDialog` and `PermissionMatrixCenter`, disabling `view` automatically clears and disables all other actions for that module (`create`, `edit`, `delete`, `export`, etc.) since actions require view permission. |
| 8 | Action Dependency | Enabling any sub-action (e.g. `create` or `edit`) | Automatically enables the `view` permission for that module if not already enabled. |
| 9 | Permission Matrix Search | Search keyword in Arabic (e.g. "الإسكان", "صيانة") vs English (e.g. "housing", "maintenance", "edit") | Filters both module names and action names in real-time across both languages. If no modules match, displays an empty search state without crashing. |
| 10 | RTL Text Alignment | Modal inputs and dropdowns under RTL | Text inputs align to the right (`text-left rtl:text-right`), search icons sit on the right (`right-3 rtl:right-3 rtl:left-auto`), input padding flips (`pl-9 rtl:pr-9 rtl:pl-3`), close button flips positioning or stays accessible. |

---

## 1. Observation

### 1.1 Baseline Build Status
Direct execution of build verification commands on the existing codebase:

1. **Frontend Production Build**:
   - Command: `npm run build` in `artifacts/housing`
   - Result: **Exit Code 0**
   - Timing: **21.20s**
   - Output directory: `dist/public/`
   - Warnings: Sourcemap rollup notices filtered cleanly by `vite.config.ts`. No syntax, bundle, or TypeScript build errors.
   - Output bundle includes modern vendor chunks: `react`, `react-dom`, `@tanstack/react-query`, `lucide-react`, `sonner`, `date-fns`, `jspdf`, `xlsx`.

2. **API Server Production Build**:
   - Command: `npm run build` in `artifacts/api-server`
   - Result: **Exit Code 0**
   - Timing: **511ms**
   - Output files: `dist/index.mjs` (3.8 MB), `dist/run-migration.mjs` (853.4 KB), `pino-worker.mjs`, etc. Clean exit.

### 1.2 UI Component Catalog (`artifacts/housing/src/components/ui/`)
A total of **70 UI component files** are present in `artifacts/housing/src/components/ui/`. Key components probed:
- **`dialog.tsx`**:
  - Encapsulates `@radix-ui/react-dialog`.
  - Built-in overlay with `backdrop-blur-sm bg-black/60`.
  - `DialogContent` includes `max-h-[90vh] overflow-hidden` with an inner scroll container `<div className="overflow-y-auto flex-1 p-6">{children}</div>`.
  - Includes Radix accessibility compliance: hidden `<DialogPrimitive.Title className="sr-only">{srTitle ?? "Dialog"}</DialogPrimitive.Title>` and `<DialogPrimitive.Description className="sr-only">Dialog content</DialogPrimitive.Description>`.
  - Can be styled with custom width: `className="max-w-2xl"` or `max-w-4xl"`.
- **`sheet.tsx`**: Radix dialog variant supporting slide-out side drawers (`side="right"`, `"left"`).
- **`tabs.tsx`**: Radix tabs with `TabsList`, `TabsTrigger`, `TabsContent` using `bg-muted` and `data-[state=active]:bg-background data-[state=active]:shadow`.
- **`switch.tsx`**: Radix switch with smooth `translate-x-4` thumb transitions.
- **`checkbox.tsx`**: Radix checkbox with primary border and Lucide `Check` icon.
- **`select.tsx`**: Radix select dropdown with scroll buttons, trigger, and content viewport.
- **`badge.tsx`**: CVA-styled badges (`default`, `secondary`, `destructive`, `outline`) with `hover-elevate`.
- **`tooltip.tsx`**: Radix tooltips with `sideOffset={4}` and animated fade/zoom in/out.
- **`scroll-area.tsx`**: Radix scroll area with customizable scrollbars.
- **`sonner.tsx`**: Toast system with luxury custom styling (`--normal-bg: hsl(var(--card))`, blurred backdrops, emerald success, rose error, amber warning, and blue info popups).
- **`permission-gate.tsx`**: Wraps any interactive UI element with `<PermissionGate module action fallback?>` invoking `usePermission().can(module, action)`.

### 1.3 Tailwind Theme Tokens & Styling System
Probed from `artifacts/housing/src/index.css` and `artifacts/housing/vite.config.ts`:
- **Tailwind Version**: Tailwind v4 via `@tailwindcss/vite` and `@import "tailwindcss";`.
- **Color Tokens**:
  - **Primary Gold**: `#C9A24D` (`hsl(41 56% 54%)`), used for active highlights, focus rings, primary brand badges, and accent lines.
  - **Sidebar / Header Navy**: `#0F2A44` (`hsl(209 64% 16%)` in light mode, `hsl(209 64% 12%)` in dark mode), used for primary modal headers, key action buttons, and navigation.
  - **Cards & Popovers**: Pure white `hsl(0 0% 100%)` in light mode, deep dark navy-slate `hsl(220 20% 12%)` in dark mode.
  - **Borders**: `hsl(220 13% 91%)` (light), `hsl(220 13% 15%)` (dark).
  - **Destructive**: `hsl(0 84% 60%)`.
- **Glassmorphism & Surface Utilities**:
  - `.glass-effect`: `bg-white/10 dark:bg-slate-900/10 backdrop-blur-md border border-white/20`.
  - `.form-section-label`: `text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3`.
  - `.icon-btn`, `.icon-btn-primary`, `.icon-btn-danger`, `.icon-btn-warning`, `.icon-btn-success`.
  - Micro-animations: `animate-fade-in`, `animate-fade-in-up`, `slideInRight`, `slideInLeft`.

### 1.4 Bilingual (Arabic RTL & English LTR) Standards
Probed from `LanguageContext.tsx` and across page implementations:
- **Font Stack**:
  - Latin: `'Inter', sans-serif`.
  - Arabic: `'Cairo', sans-serif`.
  - Global CSS rule: `[dir="rtl"], [dir="rtl"] * { font-family: "Cairo", sans-serif; }`.
- **Context API**:
  - `const { language, setLanguage, dir } = useLanguage();`
  - `const ar = language === "ar";`
- **Directional UI Patterns**:
  - Text alignment: `text-left rtl:text-right`.
  - Input icons: `Search` icon positioned with `left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3`, paired with input padding `pl-9 rtl:pr-9 rtl:pl-3`.
  - Chevron icons in navigation/steppers: `<ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" />`.
  - Badge floating: `ml-auto rtl:ml-0 rtl:mr-auto`.
  - Element spacing: prefer flex `gap-*` (direction-agnostic) or `rtl:space-x-reverse`.

### 1.5 API Contracts & Backend Validation (`artifacts/api-server/src/routes/users.ts`)
- **`GET /api/users`**:
  - Requires permission: `users.view`.
  - Query params: `page` (number, default 1), `limit` (number, default 50, max 100), `search` (string), `role` (string), `status` (string).
  - Returns: `{ data: User[], pagination: { page, limit, total, totalPages }, summary: { total, active, locked, inactive, workflowUsers, signedWorkflowUsers, customPermissionUsers, ... } }`.
- **`GET /api/users/:id`**:
  - Requires permission: `users.view`.
  - Returns: `{ id, propertyId, propertyIds, username, email, phone, jobTitle, roles, permissions, hasSignature, status, createdAt, lockedUntil }`.
- **`POST /api/users`**:
  - Requires permission: `users.create`.
  - Validation schema: `CreateUserBody` from `@workspace/api-zod`:
    - `propertyId`: number (required).
    - `propertyIds`: number[] (optional).
    - `username`: string (required).
    - `password`: string (required).
    - `roles`: string[] (required).
    - `permissions`: string[] (optional, defaults to `[]`).
    - `status`: string (optional, defaults to `"ACTIVE"`).
    - `jobTitle`: string (nullish).
    - `email`: string (nullish).
    - `phone`: string (nullish).
  - Password validation against `getPasswordPolicy(propertyId)`:
    - `minLength`: 8 (default).
    - `requireUppercase`: true (`/[A-Z]/`).
    - `requireLowercase`: true (`/[a-z]/`).
    - `requireNumber`: true (`/[0-9]/`).
    - `requireSymbol`: false (`/[^A-Za-z0-9]/`).
    - Violation returns HTTP 400: `{ error: pwdValidation.errors.join("; ") }`.
  - System admin guard: `isSystemAdminRoles(roles)` requires `req.session.isSystemAdmin`.
  - Returns: HTTP 201 with created user (omitting `passwordHash`).
- **`PATCH /api/users/:id`**:
  - Guarded by `requireUserUpdatePermission`:
    - Modifying `permissions` or `roles` -> requires `users.manage_permissions`.
    - Modifying `password` -> requires `users.reset_password`.
    - Other modifications -> requires `users.edit`.
  - Validation schema: `UpdateUserBody`:
    - `username`, `email`, `phone`, `roles`, `permissions`, `status`, `password`, `jobTitle`, `propertyIds`, `propertyId`.
  - Special DB handling: If `propertyIds` is supplied, it executes direct raw query `UPDATE users SET property_ids = $1, property_id = $2 WHERE id = $3` to update PostgreSQL integer array.
  - Detailed audit logging via `logActivity`: logs added and removed permissions (`Perms added: [...] | Perms removed: [...]`).
- **TanStack Query Invalidation Keys**:
  - User list: `getListUsersQueryKey()` from `@workspace/api-client-react`.
  - Current user session: `getGetMeQueryKey()`.
  - Signature: `["user-signature", userId]`.

### 1.6 Existing User & Permission Components Inspection
1. **`CreateUserDialog.tsx`**:
   - Currently 351 lines.
   - Raw `<input type="checkbox">` used for property selection instead of Shadcn `Checkbox`.
   - Only has a static placeholder `"Minimum 6 characters"`, conflicting with backend policy (min 8 characters, uppercase, lowercase, numbers).
   - Lacks real-time password strength meter and inline field validation.
   - Layout is a simple 2-column grid without modern visual cards or role selection chips.
2. **`EditUserDialog.tsx`**:
   - Currently 423 lines.
   - Constrained to `max-w-sm` (narrow single column).
   - Completely lacks property assignment (users currently have to open a separate `EditPropertiesDialog.tsx`).
   - Uses hardcoded `bg-blue-600` buttons instead of theme tokens (`#0F2A44` / Gold).
3. **`PermissionMatrixDialog.tsx` & `PermissionMatrixCenter.tsx`**:
   - Dialog is 664 lines, Center is 875 lines.
   - Matrix manages 22 modules across 5 logical categories.
   - Implements dependency rule: disabling `view` disables all module actions; enabling any action enables `view`.
   - Implements `["none"]` payload when all permissions are deselected to prevent fallback to role defaults.
   - Lacks distinct visual indicators showing which permissions are inherited from the baseline role vs explicitly customized.

---

## 2. Logic Chain

1. **Build Baseline Integrity**:
   - Both `artifacts/housing` and `artifacts/api-server` compile cleanly with exit code 0.
   - This proves the existing codebase is in a sound state, and all changes must preserve clean compilation without regressions.

2. **UI & Design Token Synthesis**:
   - The application has established theme tokens: Primary Gold (`#C9A24D`), Deep Navy (`#0F2A44`), HSL card backgrounds, and `.glass-effect`.
   - The current `CreateUserDialog` and `EditUserDialog` suffer from UX inconsistencies: `EditUserDialog` is narrow (`max-w-sm`), uses generic blue buttons (`bg-blue-600`), and omits property assignment.
   - By structuring both dialogs into modern, cohesive visual sections (Account Credentials, Property Multi-Select, Role Selector with informative badges, Account Status, and User Signature), we align the user management experience with the project's design language.

3. **Password Policy Alignment**:
   - The backend validates passwords against `getPasswordPolicy()` with defaults `minLength: 8`, `requireUppercase: true`, `requireLowercase: true`, `requireNumber: true`.
   - The frontend `CreateUserDialog` currently prompts `"Minimum 6 characters"`. When users type 6 or 7 characters, the API rejects it with HTTP 400.
   - A real-time visual password security indicator checking length (>= 8), uppercase, lowercase, numbers, and symbols directly solves this mismatch and fulfills Requirement R1.

4. **Permission Matrix & RBAC Logic**:
   - The system operates on a dual-layer RBAC model with 22 modules and 20 actions formatted as `${module}.${action}`.
   - `ROLE_DEFAULT_PERMISSIONS` defines the standard baseline for each role (`super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff`, etc.).
   - When a user's permissions are customized, the matrix must clearly delineate between permissions that belong to the base role preset and permissions that were explicitly granted as custom overrides.
   - One-click bulk actions ("Select All", "Deselect All", "Read-Only All", and role presets) combined with real-time bilingual search filtering in both Arabic and English fulfill Requirement R2.
   - Preserving the `["none"]` sentinel value when all permissions are deselected ensures users can be given zero permissions without unintended fallback to role defaults.

5. **Bilingual RTL/LTR Architecture**:
   - Arabic mode requires `Cairo` typography and mirrored directional styling.
   - Using flexbox `gap-*`, explicit `rtl:space-x-reverse`, `rtl:rotate-180` for directional icons, and `text-left rtl:text-right` guarantees an overflow-free, balanced layout fulfilling Requirement R3.

---

## 3. Caveats

1. **Database Schema Restrictions**:
   - Per Rule 1 of the skill runbook, no DDL alterations (`ALTER TABLE`, `DROP COLUMN`) should be executed during UI refactoring. The existing `property_ids` column in `usersTable` is already supported by the API and database.
2. **Super Admin Privilege Guard**:
   - The backend explicitly prohibits non-system admins from granting `super_admin` or `admin` roles, or modifying system admin accounts. The UI should disable or hide these options when the acting user is not a system admin.
3. **Session Query Invalidation**:
   - When modifying permissions of the currently logged-in user, both `getListUsersQueryKey()` and `getGetMeQueryKey()` must be invalidated so the UI session updates immediately.

---

## 4. Conclusion & Technical Verification Checkpoints

The design system, API contracts, and requirements have been mapped to technical verification checkpoints:

### Technical Verification Checkpoints

| Requirement | Scope | Technical Verification Checkpoint | Expected Result |
|-------------|-------|-----------------------------------|-----------------|
| **R1** | `CreateUserDialog.tsx` | Form section grouping | 4 clear sections: Account Credentials, Property Multi-Select, Role Selector with badges, Account Status. |
| **R1** | `CreateUserDialog.tsx` | Real-time Password Security Indicator | Visual check indicators for >= 8 chars, uppercase, lowercase, number, and optional symbol matching `validatePassword()`. |
| **R1** | `CreateUserDialog.tsx` | Property Multi-Select | Checkboxes for all available hotel properties with badges; passes `propertyIds: number[]` to API. |
| **R1** | `EditUserDialog.tsx` | Dialog Layout Expansion | Expand from `max-w-sm` to modern multi-section layout (`max-w-2xl`), replacing `bg-blue-600` with theme Navy/Gold tokens. |
| **R1** | `EditUserDialog.tsx` | Property & Signature Integration | Allow property reassignment and signature upload directly within the dialog. |
| **R2** | `PermissionMatrixDialog.tsx` & `PermissionMatrixCenter.tsx` | Grouped Module Display | 22 modules structured into 5 operational domains (`daily_operations`, `accommodation_flow`, `employee_portal`, `management`, `security`). |
| **R2** | Matrix Components | Bulk Toggles per Module | One-click "Select All" / "Deselect All" for individual modules and globally. |
| **R2** | Matrix Components | Role-based Baseline Presets | Quick buttons to load `super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff` baselines. |
| **R2** | Matrix Components | Real-Time Bilingual Search | Search bar filtering modules and actions by Arabic and English terms simultaneously. |
| **R2** | Matrix Components | Custom vs Baseline Distinction | Visual badges/tooltips showing whether a permission is part of the baseline role or a custom override. |
| **R2** | Matrix Components | Zero-Permission Safeguard | If all permissions are removed, payload saves `permissions: ["none"]` to prevent falling back to defaults. |
| **R3** | Global Dialogs | RTL/LTR Perfect Alignment | Verified Arabic layout with `Cairo` font, no horizontal overflow, properly flipped search icons, and aligned badges. |
| **R3** | Build Verification | Frontend Production Build | `npm run build` in `artifacts/housing` must exit with code 0. |

---

## 5. Verification Method

1. **Verify Frontend Build**:
   ```bash
   cd artifacts/housing
   npm run build
   ```
   *Pass criteria*: Exits with code 0, 0 errors.

2. **Verify API Server Build**:
   ```bash
   cd artifacts/api-server
   npm run build
   ```
   *Pass criteria*: Exits with code 0, 0 errors.

3. **Verify API Contract Compliance**:
   - Inspect `artifacts/api-server/src/routes/users.ts` lines 320–543 against Zod schemas in `lib/api-zod/src/generated/api.ts`.
   - Verify payload shapes for `POST /api/users` and `PATCH /api/users/:id`.

4. **Verify Bilingual Layout Integrity**:
   - In `artifacts/housing`, toggle language between `"ar"` and `"en"`.
   - Inspect dialog containers for `dir="rtl"` / `dir="ltr"` styles, typography (`font-arabic` / `Cairo`), and overflow boundaries.
