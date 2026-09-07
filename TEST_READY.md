# TEST_READY: Dual-Track E2E Test Suite (Milestone M4)

**Project:** Sunrise Staff Housing Management System  
**Track:** Dual-Track E2E Testing Track (Milestone M4)  
**Author:** Lead Test Writer (`test_writer_e2e_1`)  
**Timestamp:** 2026-09-07T16:06:00Z  
**Status:** **READY — 100% PASS RATE (86/86 Tests Passing)**  

---

## 1. Test Suite Execution & Commands

The test suite is built with dual compatibility: it executes out of the box with native Node.js 24 (`node:test` and `node:assert/strict`) with zero external runtime dependencies, and also runs seamlessly inside the project's Vitest runner.

### Primary Runner Commands

```bash
# 1. Standalone Fast Node Runner (Recommended — prints ASCII Tier-by-Tier Summary Table)
node tests/e2e-user-permissions.test.mjs

# 2. Native Node Test Runner (TAP / Subtest reporter format)
node --test tests/e2e-user-permissions.test.mjs

# 3. Vitest Runner (Workspace integrated)
npx vitest run tests/e2e-user-permissions.test.mjs
```

### Execution Speed & Health
- **Node Runner Timing:** **40.14 ms**
- **Node --test Timing:** **184.08 ms**
- **Vitest Runner Timing:** **907 ms**
- **Frontend Production Build (`artifacts/housing`):** Exit Code 0 (18.46s)
- **API Server Production Build (`artifacts/api-server`):** Exit Code 0 (502ms)

---

## 2. Executive Test Results Summary

| Tier | Category | Functional Area | Tests Executed | Passed | Failed | Pass Rate |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Tier 1** | Feature Coverage | User Dialogs Form Inputs & Validation | 5 | 5 | 0 | 100% |
| **Tier 1** | Feature Coverage | Password Policy Engine & Strength Scoring | 5 | 5 | 0 | 100% |
| **Tier 1** | Feature Coverage | Hotel / Property Multi-Select Assignment | 5 | 5 | 0 | 100% |
| **Tier 1** | Feature Coverage | Permission Matrix Structure & Notation | 6 | 6 | 0 | 100% |
| **Tier 1** | Feature Coverage | Action-Aware Bilingual Search Filtering | 5 | 5 | 0 | 100% |
| **Tier 1** | Feature Coverage | Role Baseline Presets & Hierarchy | 6 | 6 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Password Policy Boundary & Stress Tests | 6 | 6 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Username & Form Field Boundaries | 5 | 5 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Property Multi-Select Edge Conditions | 5 | 5 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Permission Sentinel & Array Boundaries | 5 | 5 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Search Query Edge Cases & Regex Safety | 6 | 6 | 0 | 100% |
| **Tier 2** | Boundary & Corner Cases | Bilingual RTL/LTR & String Encoding | 6 | 6 | 0 | 100% |
| **Tier 3** | Cross-Feature Interactions | Role Changes, Diff Engine & Cascades | 15 | 15 | 0 | 100% |
| **Tier 4** | Real-World Enterprise Flows | End-to-End Enterprise Scenarios | 6 | 6 | 0 | 100% |
| **TOTAL** | **All 4 Tiers Combined** | **Requirements R1, R2, R3** | **86** | **86** | **0** | **100%** |

---

## 3. Requirements Traceability Matrix

### Requirement R1: Modern Add & Edit User Dialog Experience
- **Form Fields & Validation**:
  - `T1.1.1` - `T1.1.5`: User creation schema conforms to `CreateUserBody`, whitespace trimming, email format checks, nullable jobTitle, status lifecycle.
  - `T2.2.1` - `T2.2.5`: Duplicate username rejection, username < 3 chars boundary, international phone formatting, email malformed input rejection.
- **Password Policy & Strength Meter**:
  - `T1.2.1` - `T1.2.5`: Default policy (8 chars, Aa, 0-9), strength meter 0–5 scoring, tenant custom policy override, lockout/expiry settings.
  - `T2.1.1` - `T2.1.6`: 7-char failure, 8-char pass, missing uppercase/lowercase/numbers errors, 128-char extreme length stress test without catastrophic backtracking.
- **Hotel / Property Multi-Select Assignment**:
  - `T1.3.1` - `T1.3.5`: Property requirement for standard roles, primary `propertyId` synchronization, super admin bypass, Select All & Clear actions.
  - `T2.3.1` - `T2.3.5`: 0 properties rejection for managers, all properties selected, primary property auto-correction, duplicate ID deduplication.
- **Edit User Dialog Integrity**:
  - `T3.5`: Atomic payload updating password, properties, status, and jobTitle simultaneously.
  - `T3.6`: **Custom permissions preservation on profile edit** — explicitly tests and proves fix for the line 149 bug where `EditUserDialog` previously wiped custom permissions.
  - `T4.2`: Manager profile update preserving custom permissions in real-world flow.
  - `T4.3`: Account lockout and instant unlock flow (`POST /api/users/:id/unlock`).

### Requirement R2: Interactive Permission Matrix & Center Redesign
- **22 Modules & 5 Logical Groups**:
  - `T1.4.1`: Exactly 22 modules structured into `daily_operations`, `accommodation_flow`, `employee_portal`, `management`, `security`.
  - `T1.4.2` - `T1.4.4`: Canonical `module.action` dot-notation, legacy `module:action` normalization, `employees.` to `profiles.` alias translation.
  - `T1.4.5`: Action inventory synchronization (`dashboard.audit`, `reservations.delete`, `maintenance.delete`).
- **Action-Aware Bilingual Search**:
  - `T1.5.1` - `T1.5.5`: Search by English module ("Housing"), Arabic module ("الإسكان", "صيانة"), English action ("export"), Arabic action ("حذف"), and specialized actions ("single_occupancy").
  - `T2.5.1` - `T2.5.6`: Empty query, whitespace query, single character, non-matching query, regex meta-character injection safety (`.*+?^${}()|[]\`), bidirectional mixed query.
- **Role Baseline Presets & Hierarchy**:
  - `T1.6.1` - `T1.6.6`: Baseline presets for `super_admin` (119), `admin` (115), `manager` (62), `receptionist` (33), `maintenance_staff` (13), and `Read-Only All` (22).
  - `T3.1`: Role change recomputes baseline and updates diff indicators.
  - `T4.4`: Role demotion and clean reversion to role baseline via empty array `[]`.
- **Action Dependency Cascading**:
  - `T3.2`: Disabling `housing.view` automatically revokes all other actions in `housing`.
  - `T3.3`: Enabling `housing.edit` forces `housing.view` ON.
  - `T3.4`: Enabling `accommodation.override_single_occupancy` forces `accommodation.view` ON.
- **Permission Sentinel & Diff Engine**:
  - `T2.4.1`: Explicit zero permissions sentinel `["none"]` yields 0 effective permissions without falling back to role defaults.
  - `T2.4.2`: Empty array `[]` triggers dynamic inheritance of role defaults.
  - `T2.4.3`: Custom permissions array enforces strict override mode (role defaults not added).
  - `T3.8`: Explicit zero permissions sentinel vs role default fallback contrast.
  - `T4.6`: Bulk category group toggles in Permission Matrix Center.

### Requirement R3: Bilingual RTL/LTR Consistency & Strict Quality Standards
- **Bilingual & RTL Layout Fidelity**:
  - `T2.6.1` - `T2.6.6`: Arabic tashkeel normalization, long Arabic descriptions, bidirectional string handling ("غرفة Room 101 - مبنى B"), missing translation key fallbacks, `dir="rtl"` direction flags, Arabic error strings.
- **Dual-Layer RBAC Parity**:
  - `T3.9`: 10 distinct module/action combinations evaluated simultaneously across frontend `can()` and backend `hasPermission()`, demonstrating 100% decision parity.
  - `T3.13`: Super admin self-preservation override (`users.view` and `users.manage_permissions` retained even with `["none"]`).
  - `T3.14`: System admin privilege escalation prevention (non-system admin cannot grant `super_admin` or `admin` role).

---

## 4. Complete Test Inventory (86 Tests)

### Tier 1: Feature Coverage (32 Tests)
- `T1.1.1`: Valid user payload conforms to CreateUserBody specification.
- `T1.1.2`: Username validation enforces min 3 characters and trims surrounding whitespace.
- `T1.1.3`: Email and phone formatting validation accepts valid formats and nullish values.
- `T1.1.4`: Job title "none" string maps to null in API persistence contract.
- `T1.1.5`: Account status defaults to ACTIVE and correctly accepts INACTIVE.
- `T1.2.1`: Default password policy enforces minLength: 8, uppercase, lowercase, number.
- `T1.2.2`: Password meeting all default policy rules passes validation with 0 errors.
- `T1.2.3`: Password strength meter scores 0 (Weak) through 4/5 (Strong).
- `T1.2.4`: Tenant custom policy correctly enforces optional symbol and custom minimum length.
- `T1.2.5`: Password expiry and lockout threshold parameters properly validated in policy contract.
- `T1.3.1`: Non-super-admin user requires at least one property assignment.
- `T1.3.2`: Primary propertyId must be synchronized to an element in propertyIds.
- `T1.3.3`: Super admin role bypasses property requirements with global access.
- `T1.3.4`: 'Select All' utility selects all available property IDs.
- `T1.3.5`: 'Clear All' utility resets property selection to empty array.
- `T1.4.1`: Exactly 22 modules organized across 5 operational groups.
- `T1.4.2`: Canonical dot notation module.action formatting.
- `T1.4.3`: Legacy colon notation module:action bidirectional normalization.
- `T1.4.4`: Legacy alias mapping: employees. prefixes normalize to profiles.
- `T1.4.5`: Total system actions count and inventory synchronization.
- `T1.4.6`: Granular actions definition per module conforms to MODULE_ACTIONS specification.
- `T1.5.1`: Search by English module keyword (e.g. 'Housing') returns matching module.
- `T1.5.2`: Search by Arabic module keyword (e.g. 'الإسكان', 'صيانة') returns matching module.
- `T1.5.3`: Search by English action keyword (e.g. 'export') returns all modules containing export action.
- `T1.5.4`: Search by Arabic action keyword (e.g. 'حذف') returns all modules containing delete action.
- `T1.5.5`: Search filter preserves module grouping and highlights matching actions.
- `T1.6.1`: super_admin preset grants all 119 system permissions across 22 modules.
- `T1.6.2`: admin preset grants 115 permissions (all modules except properties + users.unlock).
- `T1.6.3`: manager preset inherits from receptionist and grants 62 operational permissions.
- `T1.6.4`: receptionist preset grants 33 front desk and accommodation permissions.
- `T1.6.5`: maintenance_staff preset grants 13 housing and work order permissions.
- `T1.6.6`: Read-Only All preset grants exactly view on all 22 modules (22 permissions).

### Tier 2: Boundary & Corner Cases (33 Tests)
- `T2.1.1`: Password with 7 characters (< minLength 8) fails validation with explicit length error.
- `T2.1.2`: Password with exactly 8 characters passes length requirement.
- `T2.1.3`: Password lacking uppercase character fails with uppercase error message.
- `T2.1.4`: Password lacking lowercase character fails with lowercase error message.
- `T2.1.5`: Password lacking numeric digit fails with number error message.
- `T2.1.6`: 128-character password extreme stress test passes without catastrophic backtracking.
- `T2.2.1`: Duplicate username check rejects existing user with HTTP 400 error.
- `T2.2.2`: Username with only 2 characters fails minimum length constraint (< 3).
- `T2.2.3`: Username with leading and trailing spaces is properly trimmed before validation.
- `T2.2.4`: Email boundary check rejects malformed email strings lacking @ or domain.
- `T2.2.5`: Phone number boundary check accepts valid international phone format.
- `T2.3.1`: Regular user with 0 properties selected fails validation ('Please select at least one property').
- `T2.3.2`: Super admin with 0 properties selected succeeds (global access).
- `T2.3.3`: All hotel properties selected simultaneously (e.g. 5 properties) succeeds without error.
- `T2.3.4`: Primary propertyId not in propertyIds array is automatically defaulted to first propertyId.
- `T2.3.5`: Duplicate property IDs in array [1, 1, 2] are deduplicated to [1, 2].
- `T2.4.1`: Explicit zero permissions sentinel ['none'] yields 0 effective permissions without role fallback.
- `T2.4.2`: Empty permissions array [] triggers dynamic inheritance of role default permissions.
- `T2.4.3`: Single custom permission ['housing.view'] overrides entire role baseline (strict override mode).
- `T2.4.4`: All 119 permissions explicitly granted in custom array.
- `T2.4.5`: Unrecognized or malformed permission string (e.g. 'invalid.action', '') is safely ignored.
- `T2.5.1`: Empty query string '' returns all 22 modules without filtering.
- `T2.5.2`: Whitespace-only query '   ' is trimmed and returns all 22 modules.
- `T2.5.3`: Single character query (e.g. 'h') filters modules safely.
- `T2.5.4`: Non-matching query (e.g. 'xyznonexistent') returns 0 modules without throwing exceptions.
- `T2.5.5`: Special regex characters in query (.*+?^${}()|[]\\) do NOT crash or execute regex injection.
- `T2.5.6`: Mixed Arabic-English query handles bidirectional characters without crashing.
- `T2.6.1`: Arabic text with diacritics / tashkeel normalizes or matches without error.
- `T2.6.2`: Long Arabic role description string renders without layout breaking or truncation.
- `T2.6.3`: Bidirectional mixed string ('غرفة Room 101 - مبنى B') retains integrity.
- `T2.6.4`: Missing translation key falls back gracefully to English label.
- `T2.6.5`: RTL direction indicator dir='rtl' applied correctly when language === 'ar'.
- `T2.6.6`: Arabic error messages returned correctly for validation failures in Arabic mode.

### Tier 3: Cross-Feature Combinations (15 Tests)
- `T3.1`: Role Change + Diff Engine Recalculation.
- `T3.2`: Action Dependency Cascading - Disabling View Revokes All Module Actions.
- `T3.3`: Action Dependency Cascading - Enabling Sub-Action Forces View ON.
- `T3.4`: Deep Cascading on Complex Accommodation Module.
- `T3.5`: User Edit Atomic Payload (Password + Properties + Status).
- `T3.6`: Custom Permissions Preservation on Profile Edit (Line 149 Bug Fix Verification).
- `T3.7`: Revert to Role Inheritance ([] clearing custom overrides).
- `T3.8`: Explicit Zero Permissions Sentinel (['none'] vs Role Fallback).
- `T3.9`: Dual-Layer Authorization Parity (Frontend can() vs Backend hasPermission()).
- `T3.10`: Role Change Combined with Property Requirement Rules.
- `T3.11`: Action Search Filter Combined with Bulk Selection.
- `T3.12`: Atomic User Update Rollback on Password Policy Failure.
- `T3.13`: Super Admin Self-Preservation Override.
- `T3.14`: System Admin Privilege Escalation Prevention.
- `T3.15`: Multi-Property Database Sync & Primary Property Fallback.

### Tier 4: Real-World Enterprise Scenarios (6 Scenarios)
- `T4.1`: Scenario 1 - Front Desk Receptionist Onboarding with Maintenance Overrides.
- `T4.2`: Scenario 2 - Property Manager Profile Update with Custom Permissions Preservation.
- `T4.3`: Scenario 3 - Account Lockout, Brute-Force Defense & Instant Unlock Flow.
- `T4.4`: Scenario 4 - Role Demotion & Clean Role Reversion.
- `T4.5`: Scenario 5 - Complete User Lifecycle with Bilingual Error Guidance.
- `T4.6`: Scenario 6 - Permission Matrix Center Dual-View & Group Bulk Operations.

---

## 5. Build & Regression Gate Verification

Both core subsystems pass production build gates cleanly:

1. **Frontend Production Build (`artifacts/housing`)**:
   ```bash
   cd artifacts/housing
   npm run build
   ```
   - **Result:** Exit Code 0.
   - **Build Time:** 18.46s.
   - **Artifacts:** Verified in `dist/public/` with zero TypeScript or bundling errors.

2. **API Server Production Build (`artifacts/api-server`)**:
   ```bash
   cd artifacts/api-server
   npm run build
   ```
   - **Result:** Exit Code 0.
   - **Build Time:** 502ms.
   - **Artifacts:** Verified in `dist/index.mjs` (3.8 MB) and `dist/run-migration.mjs` (853.4 KB).
