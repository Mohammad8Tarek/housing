# Scope: Milestone M1 — Modern Add & Edit User Dialogs Experience

## Scope Ownership
- Files Owned Exclusively:
  - `artifacts/housing/src/pages/users/components/CreateUserDialog.tsx`
  - `artifacts/housing/src/pages/users/components/EditUserDialog.tsx`
  - Any new helper components strictly within `artifacts/housing/src/pages/users/components/` (e.g. `PasswordStrengthMeter.tsx`)

## Required Features
1. **Multi-Section Layout (`max-w-3xl`)**:
   - Header with icon badge, bilingual title & description.
   - Section 1: Account Credentials (Username, Email, Phone) with leading Lucide icons, live validation, and LTR font-mono styling.
   - Section 2: Security & Password:
     - In `CreateUserDialog`: required password field with Eye/EyeOff toggle.
     - In `EditUserDialog`: collapsible "Change Password" section with Eye/EyeOff toggle.
     - Visual password strength indicator (4 bars) and real-time rule chips (>=8 chars, uppercase, lowercase, number, symbol) matching backend password policy.
   - Section 3: Role & Access Level:
     - Rich role selector with role badges (`roleColor`) and clear scope descriptions (`super_admin`, `admin`, `manager`, `receptionist`, `maintenance_staff`, etc.).
     - Workflow role selector for approval hierarchy.
     - Dynamic permission preview badge.
   - Section 4: Property Assignment:
     - Interactive multi-select grid with hotel code badges (`p.code`), "Select All" / "Clear" buttons.
     - Primary branch indicator (star icon).
     - Global access banner for `super_admin`.
   - Section 5: Account Status & Signature:
     - Segmented status selector (`ACTIVE` / `INACTIVE`).
     - In `EditUserDialog`: if user is locked (`status === "LOCKED"` or `lockedUntil`), show lockout warning with remaining time and one-click "Unlock" button calling `POST /api/users/:id/unlock`.
     - Digital signature upload card (preview, upload base64 image, replace).
2. **Critical Bug Fix in `EditUserDialog.tsx`**:
   - Do NOT overwrite `user.permissions` with role defaults on save!
   - Preserve existing custom permissions:
     `permissions: user.permissions && user.permissions.length > 0 ? user.permissions : getPermissionsForRoles(resolvedRoles)`
3. **Bilingual RTL/LTR**:
   - Cairo font for Arabic, Inter for English, LTR for passwords/phone/username.
   - No horizontal overflow.
4. **Verification**:
   - Production build `cd artifacts/housing && npm run build` must exit 0.

## Survey Report References
- `e:\lab\Sunrise-Housing-FULL\final_project\.agents\explorer_survey_dialogs_1\handoff.md`
- `e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1\handoff.md`
