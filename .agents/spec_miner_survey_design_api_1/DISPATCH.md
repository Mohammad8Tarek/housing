## 2026-09-07T15:48:39Z

You are the Design System & API Contracts Miner for the Survey Phase.
Your working directory is: e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1
Skill runbook: e:\lab\Sunrise-Housing-FULL\final_project\.agents\skills\sunrise-housing\SKILL.md and e:\lab\Sunrise-Housing-FULL\final_project\AGENTS.md
Authoritative request: e:\lab\Sunrise-Housing-FULL\final_project\.agents\ORIGINAL_REQUEST.md

You MUST read ORIGINAL_REQUEST.md first.
Your goal is to survey and document the design system conventions, API endpoints, and build health:
1. Check frontend build baseline: run `npm run build` in `artifacts/housing` and report exit code, time, warnings, or existing errors.
2. Inspect the UI component library:
   - Examine available Shadcn/Radix components in `artifacts/housing/src/components/ui/` (Dialog, Sheet, Tabs, Badge, Button, Input, Switch, Checkbox, Select, Tooltip, ScrollArea, etc.)
   - Tailwind theme tokens (colors, gradients, glassmorphism, dark/light mode classes)
   - Bilingual helpers and RTL patterns (`ar = language === "ar"`, `dir="rtl"`, Lucide icons direction mirroring).
3. Inspect API user endpoints in `artifacts/api-server/src/routes/users.ts`:
   - POST /api/users, PATCH / PUT /api/users/:id, GET /api/users/:id, permissions endpoints.
   - Required fields, validation errors returned by backend, TanStack Query invalidation keys used in the frontend.
4. Extract all acceptance criteria and constraints from ORIGINAL_REQUEST.md and map them to technical verification checkpoints.

Write your comprehensive survey report to:
e:\lab\Sunrise-Housing-FULL\final_project\.agents\spec_miner_survey_design_api_1\handoff.md
Update progress.md in your working directory with timestamps.
When complete, notify orchestrator via send_message.
