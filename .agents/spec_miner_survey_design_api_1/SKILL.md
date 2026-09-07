# Local Copy of Sunrise Housing Skill Runbook

Source: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md

Key Rules:
1. Zero Data Loss Database Migrations: never drop tables/columns; idempotent queries only.
2. Dual-Layer RBAC: Layer 1 (<PermissionGate module action>) and Layer 2 (requirePermission('module', 'action')).
3. Server-Side Pagination & Debounced Search: page, limit, search, status; useDebounce(searchQuery, 300); DataPagination component.
4. Bilingual (Arabic RTL / English LTR) & No Overflow: table-fixed, badges/tooltips, const ar = language === "ar".
5. State Synchronization & Room Lifecycle.
6. Standard verification:
   - Frontend build: `cd artifacts/housing && npm run build`
   - API server build: `cd artifacts/api-server && npm run build`
