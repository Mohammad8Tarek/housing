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
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { apiRateLimit } from "./middlewares/rate-limit.js";
import { auditLogMiddleware } from "./middlewares/audit-log.js";
import { sanitizeDates } from "./middlewares/sanitize-date.js";
import { xssSanitize } from "./middlewares/xss-sanitize.js";
import { botDetection } from "./middlewares/bot-detection.js";
import { notFoundHandler, errorHandler } from "./middlewares/error-handler.js";

const isProduction = process.env["NODE_ENV"] === "production";

function requiredSecret(name: string, fallback: string): string {
  const value = process.env[name];
  if (isProduction && (!value || value === fallback || value.length < 32)) {
    throw new Error(
      `${name} must be set to a strong value of at least 32 characters in production`,
    );
  }
  return value ?? fallback;
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) ? asNumber : value;
}

// Auto-trust proxy when not explicitly configured (Vercel, Railway)
const trustProxy = process.env["TRUST_PROXY"]
  ? parseTrustProxy(process.env["TRUST_PROXY"])
  : true;

// 1. تعريف الـ Express instance أولاً ✅
const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", trustProxy);

// 2. إعداد الـ Logging
app.use(
  pinoHttp({
    logger,
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
  }),
);

const rawOrigins = (process.env["ALLOWED_ORIGINS"] ?? "").trim();
const allowList = rawOrigins
  ? rawOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];
if (isProduction && allowList.length === 0) {
  logger.warn(
    "ALLOWED_ORIGINS is empty in production; browser CORS requests will be blocked.",
  );
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        // API server replies with JSON; no inline scripts/styles allowed in responses.
        // Browsers receiving these CSPs will harden any HTML responses they see.
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        // Allow JSON / image responses back to the SPA running on same origin
        imgSrc: ["'self'", "data:", "blob:"],
        // Connection targets allowed even when browsers strictly enforce CSP
        connectSrc:
          allowList.length > 0 ? ["'self'", ...allowList] : ["'self'"],
        // No script execution expected from JSON API, block by default
        scriptSrc: ["'none'"],
        // No inline styles expected from JSON API, block by default
        styleSrc: ["'none'"],
        // Workers (none) and manifest (none) — defensive defaults
        workerSrc: ["'none'"],
        manifestSrc: ["'none'"],
        // Lock down framing entirely
        childSrc: ["'none'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    xssFilter: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }),
);
app.use(compression({ threshold: 1024 }));

// Request ID tracing + Security headers middleware
app.use((req, res, next) => {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);

  // Cache-Control: no-store for API responses (sensitive data)
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");

  next();
});

// 3. إعداد الـ CORS
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function sameOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!unsafeMethods.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source =
    typeof origin === "string"
      ? origin
      : typeof referer === "string"
        ? referer
        : "";
  if (!source) {
    next();
    return;
  }

  let sourceOrigin = "";
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }

  const hostOrigin = `${req.protocol}://${req.get("host")}`;
  const allowed =
    sourceOrigin === hostOrigin ||
    allowList.includes(sourceOrigin) ||
    (!isProduction && allowList.length === 0);
  if (!allowed) {
    res.status(403).json({ error: "Request origin is not allowed" });
    return;
  }
  next();
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      // Allow localhost/127.0.0.1 in non-production regardless of ALLOWED_ORIGINS
      if (
        !isProduction &&
        typeof origin === "string" &&
        (origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin.includes("[::1]"))
      ) {
        return cb(null, true);
      }

      if (allowList.length === 0 && !isProduction) return cb(null, true);
      if (allowList.includes(origin as string)) return cb(null, true);

      // Provide a clearer error for debugging
      const err = new Error(`CORS: origin "${origin}" is not allowed.`);
      logger.warn({ origin, allowList }, "Blocked CORS origin");
      cb(err);
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
app.use("/api", sameOriginGuard);

// 4. Bot detection قبل Body Parsing (نوفر موارد السيرفر)
app.use("/api", botDetection);

// 5. الـ Body Parsers
const defaultJsonLimit = process.env["REQUEST_JSON_LIMIT"] ?? "10kb";
const uploadJsonLimit = process.env["UPLOAD_JSON_LIMIT"] ?? "50mb";

app.use(
  [
    "/api/documents",
    "/api/employees",
    "/api/hostings",
    "/api/hosting-requests",
    "/api/maintenance",
    "/api/portal-data",
    "/api/portal-chat",
    "/api/properties",
    "/api/settings",
    "/api/users",
  ],
  express.json({ limit: uploadJsonLimit }),
);
app.use(express.json({ limit: defaultJsonLimit }));
app.use(
  express.urlencoded({ extended: false, limit: "10kb", parameterLimit: 100 }),
);

// 5.1. HPP (HTTP Parameter Pollution) + XSS sanitization
app.use("/api", hpp());
app.use("/api", xssSanitize);

// 4.1. Custom JSON replacer لمعالجة Date objects بشكل آمن
app.set("json replacer", (key: string, value: any) => {
  if (value instanceof Date && typeof value.toISOString === "function") {
    return value.toISOString();
  }
  return value;
});

// 5. استخدام الـ Date Sanitizer بعد تعريف الـ app وقبل الـ Routes ✅
app.use("/api", sanitizeDates);

// 5.1. Native app session passthrough: read X-Session-Id header and inject as cookie
// Capacitor WebView sends cross-origin requests; sameSite:"strict" cookies won't be sent.
app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
  const sessionId = req.headers["x-session-id"] as string | undefined;
  if (sessionId && !req.headers.cookie?.includes("sunrise.sid")) {
    req.headers.cookie = `sunrise.sid=${sessionId}`;
  }
  next();
});

// 6. إعداد الـ Session
const SESSION_TIMEOUT_MS = parseInt(
  process.env["SESSION_TIMEOUT_MS"] ?? String(30 * 60 * 1000),
  10,
);

let sessionStore: any = undefined;
const sessionStoreType =
  process.env["SESSION_STORE"]?.toLowerCase() || "memory";
if (sessionStoreType !== "memory") {
  const PgSessionStore = connectPgSimple(session);
  sessionStore = new PgSessionStore({
    pool,
    tableName: process.env["SESSION_TABLE"] ?? "user_sessions",
    createTableIfMissing: true,
    pruneSessionInterval: 15 * 60,
    disableTouch: false,
    ttl: SESSION_TIMEOUT_MS / 1000,
    errorLog: (msg: any, ...args: any[]) => {
      console.error("[PgSessionStore]", msg, ...args);
    },
  });
  console.log("[Session] Using PostgreSQL store (user_sessions table)");
} else {
  console.log("[Session] Using MemoryStore");
}

const sessionMiddleware = session({
    name: process.env["SESSION_COOKIE_NAME"] ?? "sunrise.sid",
    secret: requiredSecret("SESSION_SECRET", "sunrise-dev-secret"),
    store: sessionStore,
    resave: true,
    saveUninitialized: true,
    rolling: true,
    proxy: undefined,
    genid: () => crypto.randomUUID(),
    cookie: {
      httpOnly: true,
      secure: isProduction || process.env["TRUST_PROXY"] === "true",
      sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
      maxAge: SESSION_TIMEOUT_MS,
    },
});

app.use((req, res, next) => {
  if (req.path === "/api/ping" || req.path === "/api/healthz" || req.path === "/healthz") {
    return next();
  }
  return sessionMiddleware(req, res, next);
});

// Ignore favicon requests on API domain
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// Session debug endpoint (before auth, so we can test session state)
app.get("/api/debug/session", (req, res) => {
  const store = req.sessionStore as any;
  const sid = req.sessionID;
  if (sid) {
    store.get(sid, (err: any, sess: any) => {
      res.json({
        sessionID: sid,
        cookie: req.headers["cookie"],
        storeFound: !!sess,
        storeError: err?.message,
        sessionData: sess ? { portal: sess.portal, cookie: sess.cookie } : null,
        secure: req.secure,
        protocol: req.protocol,
        "x-forwarded-proto": req.headers["x-forwarded-proto"],
        trustProxy: app.get("trust proxy"),
      });
    });
  } else {
    res.json({ sessionID: null, cookie: req.headers["cookie"] });
  }
});

// Test: set a session value directly
app.get("/api/debug/session-set", (req, res) => {
  (req.session as any).testValue = "hello-" + Date.now();
  req.session.save((err: any) => {
    res.json({ saved: !err, sessionID: req.sessionID, error: err?.message });
  });
});

// 7. الـ API Routes والـ Middlewares الخاصة بها
app.use("/api", apiRateLimit);
app.use("/api", auditLogMiddleware);
app.use("/api", router);

// 8. معالجة المسارات غير الموجودة (404)
app.use(notFoundHandler);

// 9. الـ Global Error Handler (يجب أن يكون في النهاية)
app.use(errorHandler);

export default app;
