## 2026-09-07T15:58:52Z

You are the Lead Implementation Worker for Milestone M2 (Interactive Permission Matrix & Center Redesign).
Your working directory is: e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m2_1
Skill runbook: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md and e:\lab\Sunrise-Housing-FULL\final_project\AGENTS.md
Authoritative user request: e:\lab\Sunrise-Housing-FULL\final_project\.agents\ORIGINAL_REQUEST.md
Master project document: e:\lab\Sunrise-Housing-FULL\final_project\PROJECT.md
Milestone scope document: e:\lab\Sunrise-Housing-FULL\final_project\.agents\sub_orch_m2_1\SCOPE.md
Survey findings:
- e:\lab\Sunrise-Housing-FULL\final_project\.agents\explorer_survey_permissions_1\handoff.md
- e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and your SCOPE.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own and may edit:
- artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx
- artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx
You MUST NOT edit CreateUserDialog.tsx, EditUserDialog.tsx, or lib/permissions.ts.

OBJECTIVES:
1. Revamp PermissionMatrixDialog.tsx:
   - Modern, responsive modal (max-w-4xl) with header user info, role badge, and active permissions diff counter (+X custom, -Y revoked).
   - Module Grouping: Organize the 22 modules into the 5 standard logical domains (daily_operations, accommodation_flow, employee_portal, management, security) with group progress counters and collapse/expand controls.
   - Action-Aware Bilingual Real-Time Search: Search input must filter by BOTH module labels/keys and individual action names in Arabic and English (e.g. "delete", "حذف", "export", "تصدير", "approve", "اعتماد", "unlock", "override", "single_occupancy"). Highlight matching action pills/switches.
   - Visual Distinction: Clear badges and tooltips distinguishing between:
     * Role-Default permission (Blue/Slate badge "Role Default" / "افتراضي للدور")
     * Custom Grant (Emerald/Gold badge "+ Custom" / "منح مخصص")
     * Revoked from Role (subtle Rose badge "- Revoked" / "ملغي من الدور" when unchecked)
   - Comprehensive Presets Toolbar: Presets for all 9 system roles (super_admin, admin, manager, receptionist, maintenance_staff, hr_admin, portal_admin, security_staff) + "Read-Only All".
   - Bulk Actions: Category-level "Select All" / "Clear", Module master switch, "Revert to Role Defaults" button (resets to empty array [] for dynamic role inheritance).
   - Zero-Permission Safeguard: When 0 permissions are selected, save permissions: ["none"] to prevent automatic fallback to role defaults.
   - Action dependency rules: disabling view clears sub-actions; enabling any sub-action enables view.
2. Revamp PermissionMatrixCenter.tsx:
   - Full-tab matrix center with user selection toolbar and dual-view mode:
     * View 1: Visual Card Grid view with grouped category sections and progress counters.
     * View 2: Interactive Matrix Table view (Spreadsheet style) with modules as rows, actions as columns, and interactive toggles.
   - Searchable User Selector: Combobox with user search input, avatar initials, role badge, and custom permission counter (+X custom).
   - Bulk column actions in table view (e.g. toggle View column across all visible modules).
   - Save, Reset to Stored, Revert to Role Defaults, and Export permission summary actions.
3. Ensure 100% bilingual RTL/LTR consistency, smooth micro-interactions, and zero horizontal table overflow.
4. Run frontend production build:
   cd artifacts/housing && npm run build
   Must exit with code 0 and 0 errors.

Write your complete implementation report and verification results to:
e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m2_1\handoff.md
Update progress.md regularly. When complete, send message to orchestrator.
