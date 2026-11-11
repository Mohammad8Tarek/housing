# SUNRISE Staff Housing Management

Staff housing system for SUNRISE Resorts & Cruises: rooms and beds, check-in/out,
reservations, guest hosting, housekeeping, maintenance, reports, and a resident portal.

> Working on the code? Read **[AGENTS.md](AGENTS.md)** first — architecture rules,
> verification steps, and a feature → file map. `node scripts/code-lookup.mjs <feature>`
> finds the files for any feature (English or Arabic).

## Repository layout

| Path                                                          | What lives there                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `artifacts/housing/`                                          | Admin web app — React 18, Vite, Tailwind, shadcn/ui                                                |
| `artifacts/employee-portal/`                                  | Resident portal — PWA + Capacitor Android app                                                      |
| `artifacts/api-server/`                                       | Express API, WebSocket server, queue workers, migrations runner                                    |
| `artifacts/api-server/scripts/`                               | One-off DB maintenance scripts (not part of the build)                                             |
| `lib/db/`                                                     | Drizzle schema, DB pool, `withTenant`; `lib/db/scripts/` = one-off DB scripts                      |
| `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`         | OpenAPI spec and generated client/validators                                                       |
| `lib/dates`, `lib/queue`                                      | Shared date formatting (DD/MM/YYYY) and BullMQ queues                                              |
| `lib/report-rows`                                             | Report row builders shared by the admin app and the API (server-side report pages)                 |
| `interfaces/hr-sync/`                                         | Standalone HR → housing sync daemon                                                                |
| `interfaces/hotek-bridge/`                                    | On-site bridge: Hotek PMS lock server (TCP) → cloud API                                            |
| `tests/`                                                      | End-to-end and integration test scripts                                                            |
| `scripts/`                                                    | `code-lookup.mjs`, `verify-jsx-imports.mjs` (used by builds)                                       |
| `scripts/windows/`                                            | Windows launchers: `backend.bat`, `frontend.bat`, `start-all-fast.bat`, `deploy-production.bat`, … |
| `scripts/db/`                                                 | Index migration SQL, Postgres repair/reset, data migration                                         |
| `scripts/deploy/`                                             | SSL setup, local HTTPS certs, deploy wait helper                                                   |
| `scripts/audit/`                                              | Permission/route audits and system-flow checks                                                     |
| `scripts/assets/`                                             | Icon generation                                                                                    |
| `database/dumps/`                                             | Full PostgreSQL dump for bootstrapping a test server (**contains real data**)                      |
| `docs/`                                                       | System docs, codebase map, startup guide; `docs/archive/` = past plans and reports                 |
| `docker/`, `Dockerfile.*`, `docker-compose*.yml`              | Container deployment                                                                               |
| `railway.toml`, `render.yaml`, `nixpacks.toml`, `vercel.json` | Hosting configs                                                                                    |

## Quick start

```bash
pnpm install
pnpm run typecheck      # builds lib/* then type-checks every package
pnpm run deadcode       # fails on unused files or dependencies
```

On Windows, double-click `scripts\windows\start-all-fast.bat` (see [docs/STARTUP.md](docs/STARTUP.md)).

| Service         | URL                       |
| --------------- | ------------------------- |
| API             | http://localhost:4000/api |
| Admin app       | http://localhost:9000     |
| Resident portal | http://localhost:10000    |
