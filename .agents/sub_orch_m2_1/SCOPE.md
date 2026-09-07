# Scope: Milestone M2 — Interactive Permission Matrix & Center Redesign

## Scope Ownership
- Files Owned Exclusively:
  - `artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx`
  - `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx`

## Required Features
1. **Module Grouping (5 Logical Domains)**:
   - `daily_operations`: Dashboard, Housing, Housekeeping, Maintenance
   - `accommodation_flow`: Profiles, Accommodation, Reservations, Guest Hosting, Hosting Requests
   - `employee_portal`: Portal Content, Activities, Documents, Surveys, Communications
   - `management`: Reports, Evaluations, Billing, Settings, Properties
   - `security`: Users, Activity Log, Smart Locks
   - Display group progress counters (e.g. `12 / 24 active`) and category collapse/expand.
2. **Action-Aware Bilingual Real-Time Search**:
   - Filter matches BOTH module labels/keys and individual action names in Arabic and English (e.g. "حذف", "delete", "تصدير", "export", "approve", "اعتماد", "unlock", "override").
   - Highlight matching action chips/switches.
3. **Role vs Custom Visual Distinction**:
   - Compute baseline permissions for user's primary role (`ROLE_DEFAULT_PERMISSIONS[role]`).
   - Clear visual states:
     - Checked + Blue/Slate badge `Role Default` (افتراضي للدور).
     - Checked + Emerald/Gold badge `+ Custom` (منح مخصص).
     - Unchecked + subtle Rose badge `- Revoked` (ملغي من الدور) if normally included in role.
   - Header summary pill displaying active diff: e.g. `+3 custom grants`, `-1 revoked`.
4. **Comprehensive Role Presets & Bulk Toggles**:
   - Quick preset buttons for ALL 9 system roles:
     `super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff`, `hr_admin`, `portal_admin`, `security_staff`, and `Read-Only All`.
   - Category-level bulk action ("Select All in Group", "Clear Group").
   - Module-level bulk action (Master Switch).
   - "Revert to Role Defaults" button that resets custom overrides to empty array `[]` (dynamic role inheritance).
   - Safeguard: if 0 permissions selected, send `permissions: ["none"]` so backend does not fall back to role defaults.
5. **Enhanced Center UX**:
   - Searchable combobox for user selection with avatar, username, role badge, and custom permission counter.
   - Dual-view toggle:
     1. Visual Card Grid view.
     2. Interactive Matrix Table (Spreadsheet view) with modules as rows and actions as columns.
6. **Bilingual RTL/LTR & Quality**:
   - RTL/LTR responsive layout with zero overflow, smooth transitions.
   - Frontend build `cd artifacts/housing && npm run build` must exit 0.

## Survey Report References
- `e:\lab\Sunrise-Housing-FULL\final_project\.agents\explorer_survey_permissions_1\handoff.md`
- `e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1\handoff.md`
