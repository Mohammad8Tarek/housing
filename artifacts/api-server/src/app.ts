/**
 * api-server/src/app.ts — Express Application
 *
 * Fixes:
 * 1. Correct Initialization: 'app' is defined BEFORE usage.
 * 2. Middleware Ordering: Sanitize and Security middlewares are placed before routes.
 * 3. Error Handling: Global handler for all async errors.
 */

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { apiRateLimit } from "./middlewares/rate-limit.js";
import { auditLogMiddleware } from "./middlewares/audit-log.js";
import { sanitizeDates } from "./middlewares/sanitize-date.js";
import { pool } from "@workspace/db";
// @sentry/node imported dynamically below to prevent crash if not installed
import { setupSwagger } from "./lib/swagger.js";

// 1. تعريف الـ Express instance أولاً ✅
const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// 2. إعداد الـ Logging
app.use(
  pinoHttp({
    logger: logger as any,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
    autoLogging: {
      ignore: (req) => {
        return (
          req.url?.includes("/health") || req.url?.includes("/notifications")
        );
      },
    },
    customLogLevel: (req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    errorKey: "error",
  }),
);

// 3. إعداد الـ CORS
const rawOrigins = (process.env["ALLOWED_ORIGINS"] ?? "").trim();
const allowList = rawOrigins
  ? rawOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.length === 0) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin "${origin}" is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// 4. الـ Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 4.1. Custom JSON replacer لمعالجة Date objects بشكل آمن
app.set("json replacer", (key: string, value: any) => {
  if (value instanceof Date && typeof value.toISOString === "function") {
    return value.toISOString();
  }
  return value;
});

// 5. استخدام الـ Date Sanitizer بعد تعريف الـ app وقبل الـ Routes ✅
app.use("/api", sanitizeDates);

// 5.5. Health Checks and Utilities
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", message: "Database unreachable" });
  }
});

app.get("/api/ping", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ✅ Temp route to force-reset admin password on Railway DB
app.get("/api/force-admin", async (_req, res) => {
  try {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash("test123", 10);
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1",
    );
    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE username = 'admin'",
        [hash],
      );
      res.send("Admin password reset to: test123");
    } else {
      await pool.query(
        "INSERT INTO users (username, email, password_hash, roles, status) VALUES ('admin', 'admin@example.com', $1, '[\"super_admin\"]', 'active')",
        [hash],
      );
      res.send("Admin user created with password: test123");
    }
  } catch (err: any) {
    res.status(500).send("Error: " + err.message);
  }
});

// 6. إعداد الـ Session
const SESSION_TIMEOUT_MS = parseInt(
  process.env["SESSION_TIMEOUT_MS"] ?? String(30 * 60 * 1000),
  10,
);
const sessionStoreType = (
  process.env["SESSION_STORE"] ?? "memory"
).toLowerCase();
let sessionStore: session.Store | undefined;

if (sessionStoreType === "postgresql") {
  try {
    const PgSessionStore = connectPgSimple(session);
    sessionStore = new PgSessionStore({
      pool,
      tableName: process.env["SESSION_TABLE"] ?? "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 15 * 60,
      ttl: SESSION_TIMEOUT_MS / 1000,
      disableTouch: false,
    }) as unknown as session.Store;
  } catch (err) {
    console.error(
      "[Session] Failed to init PostgreSQL store, falling back to MemoryStore:",
      err,
    );
  }
}

const sessionMiddleware = session({
  name: "sunrise.sid",
  secret: process.env["SESSION_SECRET"] ?? "sunrise-dev-secret",
  store: sessionStore,
  resave: true,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
    maxAge: SESSION_TIMEOUT_MS,
  },
});

app.use((req, res, next) => {
  if (
    req.path === "/api/ping" ||
    req.path === "/api/healthz" ||
    req.path === "/healthz"
  ) {
    return next();
  }
  return sessionMiddleware(req, res, next);
});

// 7. الـ API Routes والـ Middlewares الخاصة بها
app.use("/api", apiRateLimit);
app.use("/api", auditLogMiddleware);

// Setup Swagger UI at /api/docs
setupSwagger(app);

app.use("/api", router);

// 8. معالجة المسارات غير الموجودة (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Sentry Error Handler (Must be before custom global error handler)
// Use .then() to avoid top-level-await in case esbuild config doesn't support it
import("@sentry/node")
  .then((Sentry) => {
    if (Sentry.setupExpressErrorHandler) {
      Sentry.setupExpressErrorHandler(app);
    }
  })
  .catch(() => {
    // Sentry not available, skip
  });

// 9. الـ Global Error Handler (يجب أن يكون في النهاية)
app.use(
  (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    console.error("❌ Global Server Error:", err);
    logger.error({ err, url: req.url, method: req.method }, "Unhandled error");

    const status = (err as any).status ?? (err as any).statusCode ?? 500;

    res.status(status).json({
      success: false,
      message:
        process.env["NODE_ENV"] === "production" && status === 500
          ? "Internal Server Error"
          : err.message || "Internal Server Error",
    });
  },
);

export default app;
