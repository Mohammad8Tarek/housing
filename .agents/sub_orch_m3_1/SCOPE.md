# Scope: Milestone M3 — RBAC Action Synchronization, UsersPage Integration & Bilingual Polish

## Scope Ownership
- Files Owned Exclusively:
  - `artifacts/housing/src/lib/permissions.ts`
  - `artifacts/housing/src/pages/users/index.tsx`
- MUST NOT modify:
  - `CreateUserDialog.tsx`, `EditUserDialog.tsx`, `PermissionMatrixDialog.tsx`, `PermissionMatrixCenter.tsx`.

## Objectives
1. **RBAC Actions Synchronization in `artifacts/housing/src/lib/permissions.ts`**:
   - In `MODULE_ACTIONS`:
     - Add `"audit"` to `dashboard` (currently only `["view", "export"]` -> add `"audit"`).
     - Add `"delete"` to `reservations` (currently omits `"delete"` -> add `"delete"`).
     - Add `"delete"` to `maintenance` (currently omits `"delete"` -> add `"delete"`).
   - In `ROLE_DEFAULT_PERMISSIONS`:
     - Ensure roles that should have these actions (e.g. `super_admin`, `admin`, `manager`) have them included where appropriate (e.g. `super_admin`, `admin` have `dashboard.audit`, `reservations.delete`, `maintenance.delete`; `manager` has `reservations.delete`, `maintenance.delete`).
2. **UsersPage Integration in `artifacts/housing/src/pages/users/index.tsx`**:
   - Ensure `properties` array is passed to `<EditUserDialog user={selectedUser} properties={properties} onClose={...} />` (previously only `user` and `onClose` were passed).
   - Verify table action triggers, shortcuts, and activeMainTab switching between "users" and "matrix".
3. **Bilingual RTL/LTR Polish**:
   - Ensure consistent Cairo / Inter fonts, no text overflow, proper alignment in both Arabic and English.
4. **Verification**:
   - Frontend production build `npm run build` in `artifacts/housing` must exit with code 0 and zero errors.
