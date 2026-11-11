# Deployment: API + PostgreSQL on Railway, web apps on Vercel

```
Browser ──► Vercel: admin (artifacts/housing)          ──/api/*──┐
        ──► Vercel: portal (artifacts/employee-portal) ──/api/*──┤ rewrites
        ──WebSocket (VITE_WS_URL, ws-token auth)─────────────────┤
                                                                 ▼
                                   Railway: API (Dockerfile.backend)
                                                                 │
                                   Railway: PostgreSQL ◄─────────┘
                                   Railway: Redis (optional, queues)
```

The API is a long-running server (WebSocket, BullMQ workers, Hotek lock TCP
listener on port 10006), so it runs on Railway, not on Vercel functions.

## 1. Railway

1. **New project → Deploy from GitHub repo** → this repository.
   `railway.toml` builds `Dockerfile.backend` (the image CI builds) and health
   checks `GET /api/healthz`.
2. **Add PostgreSQL** (New → Database → PostgreSQL) in the same project.
3. **Optional: add Redis** for the BullMQ queues. Without `REDIS_URL` the
   queues are off: activity logs are written directly, and background export
   jobs (`POST /api/jobs/export`) answer 503.
4. On the API service, **Variables**:

   | Variable                                                            | Value                                                                                                                  |
   | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                                      | `${{Postgres.DATABASE_URL}}` (reference to the Postgres service)                                                       |
   | `SESSION_SECRET`                                                    | long random string (required; the server refuses to start without it)                                                  |
   | `NODE_ENV`                                                          | `production`                                                                                                           |
   | `COOKIE_SECURE`                                                     | `true`                                                                                                                 |
   | `ALLOWED_ORIGINS`                                                   | the Vercel URLs, comma-separated, e.g. `https://housing-housing.vercel.app,https://housing-employee-portal.vercel.app` |
   | `PORTAL_URL`                                                        | the portal's Vercel URL (used in emails / links)                                                                       |
   | `REDIS_URL`                                                         | `${{Redis.REDIS_URL}}` (only if Redis was added)                                                                       |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | mail server (password recovery, notifications)                                                                         |
   | `FIREBASE_SERVICE_ACCOUNT_JSON`                                     | push notifications (portal app)                                                                                        |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`              | web push                                                                                                               |
   | `GATE_SECRET`                                                       | gate-pass signing                                                                                                      |

   `PORT` is set by Railway; the server listens on it.

5. **Networking → Generate Domain** for the API service. Note it as
   `<api-domain>` (e.g. `housing-api-production.up.railway.app`).
6. Database: the API runs all migrations (`public` + every tenant schema) on
   start-up, idempotently. **An empty database has no users**, so nobody can
   log in. Restore existing data into the Railway Postgres **before** the first
   start (`psql "$DATABASE_URL" < dump.sql`). The auto-seeder only runs when
   `seed-data.json` is present and the database has no properties.

## 2. Vercel (two projects)

| Project | Root directory              | Build           | Output        |
| ------- | --------------------------- | --------------- | ------------- |
| admin   | `artifacts/housing`         | `npm run build` | `dist/public` |
| portal  | `artifacts/employee-portal` | `npm run build` | `dist`        |

1. In **both** `vercel.json` files (`artifacts/housing/vercel.json`,
   `artifacts/employee-portal/vercel.json`) the `/api/:path*` rewrite must point
   to `https://<api-domain>/api/:path*`. Requests then stay same-origin for the
   browser, so the session cookie works without CORS.
2. Environment variable in **both** projects:
   `VITE_WS_URL = wss://<api-domain>` — Vercel rewrites do not proxy
   WebSocket upgrades, so the apps connect to the API directly (authenticated
   with a short-lived ws-token, not the cookie).
3. Leave `VITE_API_URL` unset (the apps call `/api`, which Vercel rewrites).

## 3. Check

- `https://<api-domain>/api/healthz` → `{"status":"ok"}`
- Admin and portal log in, live updates arrive (WebSocket connected in the
  browser console: `[WS] connected`).
