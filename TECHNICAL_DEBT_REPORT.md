# Sunrise Housing — Technical Debt Report

> **Generated:** 2026-07-03  
> **Scope:** Full monorepo review (Backend, Admin Frontend, Employee Portal, Shared Libraries)  
> **Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low  

---

## 1. Summary

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Code Quality | 5 | 1 | 2 | 2 | 0 |
| Security | 3 | 0 | 1 | 2 | 0 |
| Architecture | 4 | 0 | 2 | 2 | 0 |
| DevOps / Tooling | 5 | 0 | 2 | 2 | 1 |
| Testing | 2 | 1 | 1 | 0 | 0 |
| **TOTAL** | **19** | **2** | **8** | **8** | **1** |

---

## 2. 🔴 Critical (Fix Immediately)

### CR-1: No Automated Tests
- **Impact:** Every deployment is a blind risk. No safety net for regressions.
- **Evidence:** Zero `*.test.*` or `*.spec.*` files in any project source. Only `node_modules` test files found.
- **Effort:** High (1–2 weeks for baseline coverage)
- **Recommended Action:**
  - Add **Vitest** to backend + frontend projects.
  - Start with:
    - Auth middleware & rate-limit tests.
    - Database query helper tests.
    - 2–3 critical component tests (Login, Dashboard).
  - Add `test` script to root `package.json` with `pnpm -r run test`.

### CR-2: Oversized Frontend Components
- **Impact:** Unmaintainable, slow to build, hard to review, high bug risk.
- **Evidence:**
  | File | Size | Lines |
  |------|------|-------|
  | `reports.tsx` | ~97 KB | ~2,500+ |
  | `housing.tsx` | ~84 KB | ~2,200+ |
  | `users.tsx` | ~62 KB | ~1,600+ |
  | `settings.tsx` | ~43 KB | ~1,100+ |
  | `portal.tsx` | ~68 KB | ~1,700+ |
- **Effort:** Medium (1 week per file)
- **Recommended Action:** See `FRONTEND_REFACTOR_PLAN.md` for detailed breakdown.

---

## 3. 🟠 High (Fix Within 1–2 Weeks)

### HI-1: Missing CI/CD Pipeline
- **Impact:** No automated checks on PRs. Broken builds can reach production.
- **Evidence:** No `.github/workflows`, no `Jenkinsfile`, no GitHub Actions.
- **Effort:** Medium (1–2 days)
- **Recommended Action:**
  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on: [push, pull_request]
  jobs:
    lint-typecheck-test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
        - run: pnpm install
        - run: pnpm run typecheck
        - run: pnpm run build
        - run: pnpm run test
  ```

### HI-2: Hardcoded Passwords in Config
- **Impact:** `admin123` fallback in `docker-compose.yml` and `docker-compose.ssl.yml` is a security risk if `.env` is missing.
- **Evidence:** `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-admin123}`
- **Effort:** Low (1 hour)
- **Recommended Action:** Remove fallback entirely. Force `.env` file presence with `:?` syntax.

### HI-3: No API Documentation
- **Impact:** 36 route files, ~50+ endpoints. Onboarding new devs is painful.
- **Effort:** Medium (2–3 days)
- **Recommended Action:** Add `swagger-jsdoc` + `swagger-ui-express` to backend. Or generate OpenAPI from Zod schemas.

### HI-4: No Error Tracking / Crash Reporting
- **Impact:** Production crashes go unnoticed.
- **Evidence:** No Sentry, LogRocket, Rollbar, or similar.
- **Effort:** Low (1 day)
- **Recommended Action:** Add Sentry to both frontend and backend. Catch unhandled exceptions in `ErrorBoundary` and global error handler.

### HI-5: No Root README
- **Impact:** `STARTUP.md` only covers running locally. No architecture overview, no contributor guide.
- **Effort:** Low (1 day)
- **Recommended Action:** Write `README.md` with architecture diagram, tech stack, setup instructions, and contribution guidelines.

### HI-6: `@ts-nocheck` in `housing/src/App.tsx`
- **Impact:** Hides real TypeScript errors. Defeats type safety.
- **Evidence:** Line 1: `// @ts-nocheck`
- **Effort:** Medium (1–2 days to fix underlying errors)
- **Recommended Action:** Remove directive, fix all TS errors one by one. Most likely issues: missing types from `wouter` routes, `any` props in `ProtectedRoute`.

### HI-7: React/TypeScript Version Mismatch Between Apps
- **Impact:** Potential runtime bugs, duplicate React bundles, type mismatches.
- **Evidence:**
  - Root catalog: `react: 19.1.0`, `typescript: ~5.9.2`
  - `employee-portal`: `react: ^19.2.5`, `typescript: ~6.0.2`
- **Effort:** Low (1 hour)
- **Recommended Action:** Update catalog versions to match latest stable, remove overrides from individual `package.json` files.

### HI-8: `cloudflared.exe` (65 MB) Committed to Git
- **Impact:** Bloats repository. Binary files should not be version-controlled.
- **Evidence:** `cloudflared.exe` in root.
- **Effort:** Low (1 hour)
- **Recommended Action:** Add to `.gitignore`, remove from git history (`git filter-repo` or `BFG Repo-Cleaner`), provide a download script instead.

---

## 4. 🟡 Medium (Fix Within 1 Month)

### ME-1: Docker Build Naming Inconsistency
- **Impact:** May cause build failures if `docker build` context is not exactly right.
- **Evidence:** `Dockerfile.backend` line 10: `COPY artifacts/housing/package.json ./housing/` — destination should be `./artifacts/housing/`.
- **Effort:** Low (15 min)
- **Recommended Action:** Fix COPY destination paths in all Dockerfiles.

### ME-2: `connect-pg-simple` Externalized in esbuild but Imported at Runtime
- **Impact:** `connect-pg-simple` is in esbuild `external` list but imported in `app.ts`. If `node_modules` is missing in production image, it will crash.
- **Evidence:** `build.mjs` line 103: `"connect-pg-simple",` and `app.ts` line 22: `import connectPgSimple from "connect-pg-simple";`
- **Effort:** Low (30 min)
- **Recommended Action:** Remove from `external` list or ensure `node_modules` is available in production Docker image (currently not copied).

### ME-3: Mixed Line Endings (`CRLF` + `LF`)
- **Impact:** Git diffs become noisy. Confuses Windows + Linux developers.
- **Evidence:** `housing/src/App.tsx` has `\r\n` endings.
- **Effort:** Low (1 hour)
- **Recommended Action:** Add `.gitattributes`:
  ```
  * text=auto eol=lf
  *.bat text eol=crlf
  ```
  Then run `git add --renormalize .`.

### ME-4: Database Migrations at Runtime
- **Impact:** `runMigrations()` called on every server startup. Slows boot time. Risky if migration fails mid-deploy.
- **Evidence:** `index.ts` line 216: `await runMigrations();`
- **Effort:** Medium (2 days)
- **Recommended Action:** Separate migrations into a dedicated Docker init container or a manual deployment step. Run `drizzle-kit migrate` before starting the app.

### ME-5: No `.env.example` File
- **Impact:** New developers don't know which env vars are required.
- **Effort:** Low (30 min)
- **Recommended Action:** Create `.env.example` with all required variables (no real secrets).

### ME-6: No Database Index Audit
- **Impact:** Slow queries on large tables.
- **Evidence:** `scripts/add-missing-indexes.sql` exists but unclear if it's been applied.
- **Effort:** Medium (1 day)
- **Recommended Action:** Review query patterns in top 5 routes, add composite indexes, document in `docs/INDEXES.md`.

### ME-7: No Frontend Code Splitting / Lazy Loading
- **Impact:** All pages loaded in one bundle. Slow initial load.
- **Evidence:** `App.tsx` imports all pages statically. No `React.lazy()` or `dynamic import`.
- **Effort:** Low (1 day)
- **Recommended Action:**
  ```tsx
  const Dashboard = React.lazy(() => import("@/pages/dashboard"));
  const Housing = React.lazy(() => import("@/pages/housing"));
  // etc.
  ```
  Wrap with `<Suspense fallback={<PageLoader />}>`.

### ME-8: No Input Validation on Some Routes
- **Impact:** Potential SQL injection or data corruption.
- **Evidence:** Some routes may not use Zod validation for all inputs. Need audit of all 36 route files.
- **Effort:** Medium (2–3 days)
- **Recommended Action:** Audit every route file for `zod` usage. Ensure all `req.body`, `req.params`, `req.query` are validated before use.

---

## 5. 🟢 Low (Nice to Have)

### LO-1: No Prettier / ESLint Config at Root
- **Impact:** Inconsistent code style across packages.
- **Effort:** Low (1 hour)
- **Recommended Action:** Add `.prettierrc` and `.eslintrc` at root with `pnpm -r` lint script.

---

## 6. Recommended Sprint Plan

### Week 1
- [ ] CR-1: Add Vitest + write 5 critical tests
- [ ] CR-2: Start `reports.tsx` refactor (extract top 3 sub-components)
- [ ] HI-6: Remove `@ts-nocheck`, fix TS errors
- [ ] HI-7: Unify React/TS versions in catalog
- [ ] HI-8: Remove `cloudflared.exe` from git + add to `.gitignore`

### Week 2
- [ ] CR-2: Continue `housing.tsx` refactor
- [ ] HI-2: Remove hardcoded password fallbacks
- [ ] HI-1: Set up GitHub Actions CI pipeline
- [ ] ME-5: Add `.env.example`
- [ ] ME-3: Fix line endings with `.gitattributes`

### Week 3
- [ ] CR-2: Refactor `users.tsx`, `settings.tsx`, `portal.tsx`
- [ ] HI-3: Add Swagger/OpenAPI docs
- [ ] HI-4: Add Sentry error tracking
- [ ] ME-7: Implement lazy loading in both frontends
- [ ] ME-1: Fix Dockerfile COPY paths

### Week 4
- [ ] ME-4: Separate DB migrations from app startup
- [ ] ME-8: Audit all routes for Zod validation
- [ ] ME-6: Database index review + optimization
- [ ] HI-5: Write comprehensive `README.md`
- [ ] LO-1: Add root-level Prettier + ESLint config

---

## 7. Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | 0% | >60% |
| Largest Frontend File | ~97 KB | <20 KB |
| CI Build Time | N/A | <5 min |
| TypeScript Errors | Unknown (hidden by `@ts-nocheck`) | 0 |
| Docker Image Size | Unknown | Document + optimize |
| Average API Response Time | Unknown | <200 ms (p95) |

---

*End of Report*
