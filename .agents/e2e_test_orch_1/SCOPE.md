# Scope: E2E Testing Track — User Management & Permission Matrix Suite

## Objective
Design and implement a comprehensive opaque-box and integration test suite covering Requirements R1, R2, and R3.
Publish `TEST_READY.md` upon completion.

## Methodology
4-Tier Systematic Testing:
1. **Tier 1: Feature Coverage (>=5 per feature)**:
   - Form inputs, validation rules, property multi-select, role presets, search filtering, bulk toggles.
2. **Tier 2: Boundary & Corner Cases (>=5 per feature)**:
   - Passwords < 8 chars, missing uppercase, duplicate usernames, zero permissions (`["none"]`), empty array `[]`, maximum property selections, long Arabic/English strings.
3. **Tier 3: Cross-Feature Combinations (pairwise coverage)**:
   - Role change + custom permissions diff, property reassignment + password reset, action dependencies (disabling view clears sub-actions; enabling sub-action forces view).
4. **Tier 4: Real-World Application Scenarios**:
   - Full receptionist onboarding flow with custom maintenance permissions.
   - Manager profile update without wiping custom permissions.
   - Account lockout and instant unlock flow.

## Verification
- Automated test script/runner in Node.js / Vite testing environment that executes against the built codebase and schema definitions.
- Production build verification: `cd artifacts/housing && npm run build` must exit code 0.
