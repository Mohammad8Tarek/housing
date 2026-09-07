## 2026-09-07T16:10:02Z
You are Challenger 2 for empirical verification of the User Management & Permission Matrix Elevation.
Your working directory is: e:\lab\Sunrise-Housing-FULL\final_project\.agents\challenger_2
Skill runbook: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md and e:\lab\Sunrise-Housing-FULL\final_project\AGENTS.md
Authoritative user request: e:\lab\Sunrise-Housing-FULL\final_project\.agents\ORIGINAL_REQUEST.md
Master project document: e:\lab\Sunrise-Housing-FULL\final_project\PROJECT.md
Test suite index: e:\lab\Sunrise-Housing-FULL\final_project\TEST_READY.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and TEST_READY.md first.

Your objective:
1. Empirically verify correctness through adversarial challenge tests on RBAC and state logic:
   - Action dependency rules: verify that revoking view on any module completely strips and disables all operational sub-actions; verify that granting any sub-action auto-forces view ON.
   - Sentinel state verification: verify that saving zero permissions sends [ none] and prevents fallback to role defaults; verify that Revert to Role Defaults sends [] and restores dynamic role inheritance.
   - Profile update custom permissions preservation: verify that updating user basic attributes (phone, email, status) does NOT overwrite custom permissions (proves line 149 fix).
   - Dual-layer authorization parity: evaluate permissions across frontend can() and backend hasPermission() to ensure 100% decision parity.
   - Account lockout and unlock: verify lockout state detection and POST /api/users/:id/unlock invocation.
2. Execute empirical test scripts and report exact pass/fail counts.
3. Formulate an objective verdict: APPROVE or REQUEST_CHANGES.
Write your challenge report to:
e:\lab\Sunrise-Housing-FULL\final_project\.agents\challenger_2\handoff.md
Update progress.md regularly. When complete, send message to orchestrator with your verdict.
