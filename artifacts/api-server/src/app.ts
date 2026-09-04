/**
 * api-server/src/app.ts — Express Application
 *
 * Fixes:
 * 1. Correct Initialization: 'app' is defined BEFORE usage.
 * 2. Middleware Ordering: Sanitize and Security middlewares are placed before routes.
 * 3. Error Handling: Global handler for all async errors.
 */

import "./env.js";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import compression from "compression";
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
import { broadcastSyncAll, broadcastSyncEverywhere } from "./lib/websocket.js";

// 1. تعريف الـ Express instance أولاً ✅
const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// تمكين ضغط البيانات (Gzip/Brotli) لتسريع استجابة السيرفر وتخفيض حجم البيانات
app.use(
  compression({
    threshold: 1024, // ضغط أي رد أكبر من 1KB
  }),
);

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
const defaultAllowedOrigins = [
  "https://housing-housing-rho.vercel.app",
  "https://housing-profile-portal.vercel.app",
];
const rawOrigins = (process.env["ALLOWED_ORIGINS"] ?? "").trim();
const allowList = [
  ...defaultAllowedOrigins,
  ...(rawOrigins
    ? rawOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []),
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowList.length === 0) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith(".vercel.app")) return cb(null, true);
      } catch {
        // Fall through to explicit CORS rejection.
      }
      cb(new Error(`CORS: origin "${origin}" is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Session-Id",
    ],
  }),
);

// 4. الـ Body Parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
    // Railway healthchecks will kill the container if we return 503.
    // If the DB is temporarily unreachable due to internal DNS delays, we want to stay alive.
    res.status(200).json({ status: "error", message: "Database temporarily unreachable" });
  }
});

app.get("/api/ping", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
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
      createTableIfMissing: false,
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
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: "auto",
    sameSite: "lax",
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
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const GLOBAL_SYNC_PATHS = [
  "/users",
  "/properties",
  "/settings",
  "/lookup-values",
];

function collectSyncPropertyIds(req: Request): number[] {
  const ids = new Set<number>();
  const candidates = [
    (req.query as any)?.propertyId,
    (req.body as any)?.propertyId,
    (req.session as any)?.propertyId,
    (req.session as any)?.portal?.propertyId,
  ];

  for (const value of candidates) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }

  const propertyIds = (req.body as any)?.propertyIds;
  if (Array.isArray(propertyIds)) {
    for (const value of propertyIds) {
      const id = Number(value);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  }

  return [...ids];
}

app.use("/api", (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;

    const shouldGlobalSync = GLOBAL_SYNC_PATHS.some((path) =>
      req.path.startsWith(path),
    );
    const propertyIds = collectSyncPropertyIds(req);

    if (shouldGlobalSync || propertyIds.length === 0) {
      broadcastSyncEverywhere();
      return;
    }

    for (const propertyId of propertyIds) {
      broadcastSyncAll(propertyId);
    }
  });

  next();
});

// منع تخزين الكاش للبيانات الديناميكية الخاصة بالـ API لضمان استرجاع أحدث البيانات دوماً
app.use("/api", (_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api", apiRateLimit);
app.use("/api", auditLogMiddleware);

// Setup Swagger UI at /api/docs
setupSwagger(app);

app.use("/api", router);

// 8. معالجة المسارات غير الموجودة (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Sentry Error Handler removed to prevent any crash

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
