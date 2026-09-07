# Project: Sunrise Staff Housing — User Dialogs & Permission Matrix Elevation

## Architecture
The Sunrise Staff Housing Management System is an enterprise React 18 / Vite / TailwindCSS / Radix UI application backed by an Express/Node.js API server and PostgreSQL 18 with multi-tenant schema isolation.
This project modernizes the User Administration experience and Permission Management Center:
1. **User Dialogs Layer**: `CreateUserDialog.tsx` and `EditUserDialog.tsx` redesigned into responsive, multi-section cards with credentials, real-time validation, password policy security meters, hotel/property multi-select, role badges, and account status/lockout handling.
2. **Permission Matrix Layer**: `PermissionMatrixDialog.tsx` and `PermissionMatrixCenter.tsx` revamped into interactive, frictionless matrix controls with 22 modules across 5 operational groups, action-aware bilingual search, visual distinction between role baseline and custom overrides, bulk actions, and expanded role presets.
3. **RBAC & API Synchronization**: Canonical `module.action` formatting, safe preservation of custom permissions on user edits (fixing line 149 bug), synchronization of route guard actions (`dashboard.audit`, `reservations.delete`, `maintenance.delete`), and strict dual-layer enforcement (`<PermissionGate>` + backend middleware).
4. **Bilingual RTL/LTR Fidelity**: Pixel-perfect Cairo (AR) / Inter (EN) typography, proper icon mirroring, and no layout overflow.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Section User Dialogs | Credentials, Property Multi-Select, Roles, Status, Security | M1 | Survey R1 |
| 2 | Real-Time Password Strength Meter | 4-segment animated indicator with min 8 chars, Aa, 0-9, symbol checks | M1 | Survey R1 |
| 3 | Property Multi-Select Grid | Card-chips for properties, select all / clear, primary branch star | M1 | Survey R1 |
| 4 | Rich Role Selector with Badges | Role color badges, scope description, permissions count preview | M1 | Survey R1 |
| 5 | Account Status & Lockout Handling | Active/Inactive toggle, locked status indicator, instant unlock | M1 | Survey R1 |
| 6 | Edit User Dialog Expansion | Expand from max-w-sm to max-w-3xl, add property select and pwd reset | M1 | Survey R1 |
| 7 | Custom Permission Preservation Fix | Stop EditUserDialog line 149 from wiping custom permissions on save | M1 | Survey R1/R2 |
| 8 | Grouped Modules Matrix (5 Groups) | Daily Operations, Accommodation, Portal, Management, Security | M2 | Survey R2 |
| 9 | Action-Aware Bilingual Search | Search matches both module and action names in Arabic & English | M2 | Survey R2 |
| 10 | Role vs Custom Visual Badges | Badges & tooltips distinguishing role defaults from custom grants/revokes | M2 | Survey R2 |
| 11 | Comprehensive Role Presets | Presets for all 9 system roles + Read-Only All | M2 | Survey R2 |
| 12 | Bulk Action Controls | Select All, Deselect All, Read Only, Category Select, Revert to Role | M2 | Survey R2 |
| 13 | Searchable User Combobox (Center) | Filterable user selector with avatar, role badge, and custom perms count | M2 | Survey R2 |
| 14 | Matrix Dual View (Center) | Toggle between Visual Card Grid and Interactive Table Spreadsheet | M2 | Survey R2 |
| 15 | RBAC Actions Synchronization | Add missing `dashboard.audit`, `reservations.delete`, `maintenance.delete` | M3 | Survey R2 |
| 16 | Bilingual RTL/LTR Consistency | Cairo/Inter typography, LTR mono for codes, icon mirroring, zero overflow | M3 | Survey R3 |
| 17 | User Table Action Integration | Wire properties prop in UsersPage, verify table action shortcuts | M3 | Survey R1/R3 |
| 18 | Dual-Track E2E Test Suite | Comprehensive opaque-box and component test suite (Tiers 1-4) | M4 | Survey/Spec |
| 19 | Production Build Zero Regression | `cd artifacts/housing && npm run build` exits 0 cleanly | M4 | Survey/Spec |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Modern Add & Edit User Dialogs Experience | Redesign `CreateUserDialog.tsx` & `EditUserDialog.tsx`, validation, password indicator, property multi-select, role badges, status & fix line 149 overwrite bug | none | DONE |
| M2 | Interactive Permission Matrix & Center Redesign | Redesign `PermissionMatrixDialog.tsx` & `PermissionMatrixCenter.tsx`, action-aware search, role vs custom badges, presets, bulk controls, dual view | none | DONE |
| M3 | RBAC Action Synchronization & Bilingual Polish | Update `lib/permissions.ts` actions, wire props in `UsersPage/index.tsx`, polish RTL/LTR typography & spacing | M1, M2 | DONE |
| M4 | Comprehensive E2E Verification & Adversarial Testing | Run E2E test runner, verify frontend & backend builds, adversarial stress testing, forensic audit | M1, M2, M3 | DONE |

---

## Interface Contracts

### User CRUD Payloads
- **Create User (`POST /api/users`)**:
  ```ts
  {
    username: string; // min 3 chars
    password: string; // min 8 chars, Aa, 0-9
    roles: string[]; // e.g. ["manager"]
    permissions?: string[]; // role defaults or custom
    propertyId: number; // primary property ID
    propertyIds?: number[]; // array of assigned property IDs
    status?: "ACTIVE" | "INACTIVE";
    jobTitle?: string | null;
    email?: string | null;
    phone?: string | null;
  }
  ```
- **Update User (`PATCH /api/users/:id`)**:
  ```ts
  {
    username?: string;
    email?: string;
    phone?: string;
    roles?: string[];
    permissions?: string[]; // MUST preserve existing permissions unless explicitly changed
    status?: "ACTIVE" | "INACTIVE";
    password?: string; // optional password update
    jobTitle?: string | null;
    propertyId?: number;
    propertyIds?: number[];
  }
  ```

### Permissions Wire Format
- Array of strings formatted as `module.action` (dot-notation).
- Empty array `[]`: User inherits role default permissions dynamically.
- `["none"]`: User is explicitly denied all permissions (zero permissions).
- Non-empty array `["housing.view", "housing.edit", ...]`: User has explicit custom permissions overriding role defaults.

---

## Code Layout
- **M1 Files (User Dialogs)**:
  - `artifacts/housing/src/pages/users/components/CreateUserDialog.tsx`
  - `artifacts/housing/src/pages/users/components/EditUserDialog.tsx`
  - `artifacts/housing/src/pages/users/components/PasswordStrengthMeter.tsx`
- **M2 Files (Permission Matrix)**:
  - `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx`
  - `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx`
- **M3 Files (RBAC & Integration)**:
  - `artifacts/housing/src/lib/permissions.ts`
  - `artifacts/housing/src/pages/users/index.tsx`
- **M4 Files (Testing Track & Verification)**:
  - `tests/e2e-user-permissions.test.mjs`
  - `tests/challenger-1-adversarial.test.mjs`
  - `tests/adversarial-rbac-state.test.mjs`
  - `TEST_READY.md`
