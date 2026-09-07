## 2026-09-07T15:58:52Z
You are the Lead Implementation Worker for Milestone M1 (Modern Add & Edit User Dialogs Experience).
Your working directory is: e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m1_1
Skill runbook: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md and e:\lab\Sunrise-Housing-FULL\final_project\AGENTS.md
Authoritative user request: e:\lab\Sunrise-Housing-FULL\final_project\.agents\ORIGINAL_REQUEST.md
Master project document: e:\lab\Sunrise-Housing-FULL\final_project\PROJECT.md
Milestone scope document: e:\lab\Sunrise-Housing-FULL\final_project\.agents\sub_orch_m1_1\SCOPE.md
Survey findings:
- e:\lab\Sunrise-Housing-FULL\final_project\.agents\explorer_survey_dialogs_1\handoff.md
- e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and your SCOPE.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own and may edit:
- artifacts/housing/src/pages/users/components/CreateUserDialog.tsx
- artifacts/housing/src/pages/users/components/EditUserDialog.tsx
- artifacts/housing/src/pages/users/components/PasswordStrengthMeter.tsx (or similar helper within this folder)
You MUST NOT edit PermissionMatrixDialog.tsx, PermissionMatrixCenter.tsx, or lib/permissions.ts.

OBJECTIVES:
1. Redesign CreateUserDialog.tsx:
   - Modern max-w-3xl multi-section dialog matching project's luxury design system (Deep Navy #0F2A44, Gold #C9A24D, smooth glass cards).
   - 5 clear visual sections:
     Section 1: Account Credentials (Username, Email, Phone) with Lucide icons, LTR font-mono styling, and live validation.
     Section 2: Security & Password: required password with Eye/EyeOff toggle, animated 4-level strength indicator (Weak/Fair/Good/Strong) and live checklist chips (min 8 chars, uppercase, lowercase, number, symbol) matching backend password policy.
     Section 3: Roles & Access Level: system roles selector with role color badges (Crown/ShieldAlert for super_admin, ShieldCheck for admin, Building2 for manager, Headphones for receptionist, Wrench for maintenance_staff) and workflow role hierarchy selector.
     Section 4: Property Assignment: interactive multi-select grid with hotel code badges (p.code), "Select All" / "Clear Selection" buttons, primary property star marker, and super_admin global access banner.
     Section 5: Account Status: segmented status toggle (ACTIVE / INACTIVE).
2. Redesign EditUserDialog.tsx:
   - Expand from narrow max-w-sm to modern max-w-3xl multi-section dialog.
   - Add property multi-select assignment grid (with primary branch indicator).
   - Add collapsible "Change Password" section with password strength meter and rule checks.
   - Account status toggle (ACTIVE / INACTIVE) and lockout state handling: if user is locked (lockedUntil), show lockout alert badge and instant one-click "Unlock Account" button calling /api/users/:id/unlock.
   - Preserve digital signature management (preview, upload base64, replace).
   - CRITICAL FIX: At line 149, DO NOT overwrite custom user permissions! Preserve existing user.permissions:
     permissions: user.permissions && user.permissions.length > 0 ? user.permissions : getPermissionsForRoles(resolvedRoles)
3. Ensure 100% bilingual (Arabic RTL / English LTR) layout fidelity with Cairo font for Arabic and Inter for English.
4. Run frontend production build:
   cd artifacts/housing && npm run build
   Must exit with code 0 and 0 errors.

Write your complete implementation report and verification results to:
e:\lab\Sunrise-Housing-FULL\final_project\.agents\worker_m1_1\handoff.md
Update progress.md regularly. When complete, send message to orchestrator.
