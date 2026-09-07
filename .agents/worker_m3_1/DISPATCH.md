## 2026-09-07T16:05:33Z

You are the Lead Implementation Worker for Milestone M3 (RBAC Action Synchronization, UsersPage Integration & Bilingual Polish).
Your working directory is: e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m3_1
Skill runbook: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md and e:\lab\Sunrise-Housing-FULL\final_project\AGENTS.md
Authoritative user request: e:\lab\Sunrise-Housing-FULL\final_project\.agents\ORIGINAL_REQUEST.md
Master project document: e:\lab\Sunrise-Housing-FULL\final_project\PROJECT.md
Milestone scope document: e:\lab\Sunrise-Housing-FULL\final_project\.agents\sub_orch_m3_1\SCOPE.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and your SCOPE.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own and may edit:
- artifacts/housing/src/lib/permissions.ts
- artifacts/housing/src/pages/users/index.tsx
You MUST NOT edit CreateUserDialog.tsx, EditUserDialog.tsx, PermissionMatrixDialog.tsx, or PermissionMatrixCenter.tsx.

OBJECTIVES:
1. Synchronize RBAC actions in `artifacts/housing/src/lib/permissions.ts`:
   - In `MODULE_ACTIONS`:
     * Add "audit" to dashboard module actions (to match backend route GET /dashboard/all-stats).
     * Add "delete" to reservations module actions (to match backend route DELETE /reservations/:id).
     * Add "delete" to maintenance module actions (to match backend route DELETE /maintenance/:id).
   - In `ROLE_DEFAULT_PERMISSIONS`:
     * Add `dashboard.audit` to super_admin and admin.
     * Add `reservations.delete` to super_admin, admin, and manager.
     * Add `maintenance.delete` to super_admin, admin, and manager.
2. In `artifacts/housing/src/pages/users/index.tsx`:
   - Pass the properties list to EditUserDialog: `<EditUserDialog user={selectedUser} properties={properties} onClose={...} />`.
   - Verify modal mountings, active tab switching between table and matrix center, and table action shortcuts.
3. Verify bilingual RTL/LTR fidelity and run frontend production build:
   cd artifacts/housing && npm run build
   Must exit with code 0 and 0 errors.

Write your complete implementation report and verification results to:
e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m3_1\handoff.md
Update progress.md regularly. When complete, send message to orchestrator.
