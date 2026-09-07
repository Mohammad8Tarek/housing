# Progress — Permission Matrix Architecture Specialist

Last visited: 2026-09-07T15:52:30Z

- [x] Initialized DISPATCH.md, BRIEFING.md, and progress.md
- [x] Read ORIGINAL_REQUEST.md and skills runbook (AGENTS.md & SKILL.md)
- [x] Inspected existing permission matrix components:
  - `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx`
  - `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx`
  - `artifacts/housing/src/pages/users/index.tsx`
  - `artifacts/housing/src/pages/users/utils.ts`
  - `artifacts/housing/src/pages/users/components/CreateUserDialog.tsx`
  - `artifacts/housing/src/pages/users/components/EditUserDialog.tsx`
- [x] Inspected backend RBAC middleware and schemas:
  - `artifacts/api-server/src/middlewares/permissions.ts`
  - `lib/db/src/schema/users.ts`
  - `artifacts/api-server/src/routes/users.ts`
  - Audited all `requirePermission` backend endpoints and `PermissionGate` / `usePermission` frontend usages
- [x] Analyzed permission storage and wire formats:
  - Format: Canonical `module.action` string array, stored as native PostgreSQL `text[]` on `users.permissions`.
  - Wire payload: `{ permissions: string[] }`. Special marker `["none"]` used to explicitly wipe all permissions while avoiding fallback to role defaults.
  - Role inheritance vs custom override: Custom permissions in `users.permissions` take strict precedence. If non-empty, role defaults are ignored.
  - Critical flaw identified: `EditUserDialog` silently wipes custom permissions on edit by re-applying `getPermissionsForRoles(resolvedRoles)`.
- [x] Enumerated full inventory of 22 modules, 20 distinct actions, 119 total module permissions, and 5 logical permission groups.
- [x] Audited baseline role permission presets and identified missing roles (`hr_admin`, `portal_admin`, `security_staff`) from preset buttons.
- [x] Detailed deficits in search (module-only, misses action keywords), lack of visual distinction (no indicator for role vs custom grants), and missing category/column bulk actions.
- [x] Formulation of concrete architectural recommendations for redesigning Dialog and Center components.
- [ ] Finalize handoff report (handoff.md) and notify orchestrator.
