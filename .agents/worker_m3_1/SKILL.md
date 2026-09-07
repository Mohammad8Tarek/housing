# Sunrise Staff Housing Management - Local Skill Reference
Source: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md

Core Methodology:
1. Zero Data Loss DB Migrations: Never DROP, idempotent DDL.
2. Dual-Layer RBAC: Layer 1 PermissionGate frontend, Layer 2 requirePermission backend API.
3. Server-Side Pagination & Debounced Search: DataPagination, limit/page/search queries, debounce 300ms.
4. Bilingual (Arabic RTL / English LTR): table-fixed layout, const ar = language === "ar", no overflow.
5. State Synchronization & Room Lifecycle: clean transitions.
6. Verification: npm run build in frontend (exit code 0).
