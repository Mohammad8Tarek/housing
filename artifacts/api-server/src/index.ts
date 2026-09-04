/**
 * ✅ FINAL PRODUCTION INDEX.TS (FIXED & OPTIMIZED)
 * Location: api-server/src/index.ts
 */

import "./env.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as net from "node:net";
import v8 from "node:v8";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// ✅ ENV LOADER (Safe loading from multiple levels)
// ==========================================
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, "utf-8");

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^(["'`])(.*)\1$/, "$2");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// تحميل ملفات الـ .env من المسارات المحتملة
loadEnvFile(resolve(__dirname, "..", ".env"));
loadEnvFile(resolve(__dirname, "..", "..", ".env"));
loadEnvFile(resolve(__dirname, "..", "..", "..", ".env"));

// Sentry init removed to prevent any crash

// ==========================================
// ✅ ENV VALIDATION
// ==========================================
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
}

const PORT = 4000;
const DATABASE_URL = requireEnv("DATABASE_URL"); //
const SESSION_SECRET = requireEnv("SESSION_SECRET"); //

// Hotek Encoder (optional - loaded on demand)
const HOTEK_ENCODER_HOST = process.env.HOTEK_ENCODER_HOST || "127.0.0.1";
const HOTEK_ENCODER_PORT = process.env.HOTEK_ENCODER_PORT || "5000";

// ==========================================
// ✅ IMPORTS (Must be after Env Loading)
// ==========================================
import { createServer } from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initWebSocket, closeWebSocket } from "./lib/websocket.js";
import { runMigrations } from "./lib/migrations.js";
import { runAutoSeeder } from "./lib/seeder.js";
import { pool, healthCheck } from "@workspace/db";
import { startAllPmsServers } from "./lib/pms-server.js";
import { startAllWorkers, shutdownQueue } from "@workspace/queue";

// ==========================================
// ✅ SERVER INIT (Plain HTTP on PORT)
// ==========================================
const server = createServer(app);
server.headersTimeout = Number(
  process.env["SERVER_HEADERS_TIMEOUT_MS"] ?? 66_000,
);
server.requestTimeout = Number(
  process.env["SERVER_REQUEST_TIMEOUT_MS"] ?? 120_000,
);
server.keepAliveTimeout = Number(
  process.env["SERVER_KEEP_ALIVE_TIMEOUT_MS"] ?? 65_000,
);
server.maxHeadersCount = Number(process.env["SERVER_MAX_HEADERS_COUNT"] ?? 100);

try {
  initWebSocket(server);
} catch (err) {
  logger.error({ err }, "WebSocket initialization failed");
  process.exit(1);
}

// ==========================================
// ✅ GRACEFUL SHUTDOWN (نظام الإغلاق النظيف)[cite: 1]
// ==========================================
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated");

  try {
    // إغلاق اتصالات الـ WebSocket أولاً[cite: 1]
    await closeWebSocket();
  } catch (err) {
    logger.error({ err }, "Error during WebSocket closure");
  }

  // تنظيف rate limit store
  try {
    const { clearRateLimitStore } = await import("./middlewares/rate-limit.js");
    clearRateLimitStore();
  } catch {}

  // Stop PMS bridge servers
  try {
    const { stopAllPmsServers } = await import("./lib/pms-server.js");
    stopAllPmsServers();
  } catch {}

  // Stop BullMQ Queue workers and Redis connection
  try {
    await shutdownQueue();
  } catch (err) {
    logger.error({ err }, "Error shutting down queue workers");
  }

  // تنظيف memory monitor interval
  clearInterval(memoryMonitorInterval);

  // Close HTTP server
  server.close(async () => {
    try {
      if (pool) {
        // إغلاق اتصال قاعدة البيانات[cite: 1]
        await pool.end();
        logger.info("Database pool connection closed");
      }
    } catch (err) {
      logger.error({ err }, "Error closing database pool");
    }

    logger.info("Server shut down cleanly. Goodbye!");
    process.exit(0);
  });

  // إجبار السيرفر على القفل لو تأخر الإغلاق النظيف عن 10 ثوانٍ[cite: 1]
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10000);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Process-level error handlers prevent the server from crashing on unhandled rejections
// Without these, Node 15+ crashes the process on any unhandled async rejection.
process.on("unhandledRejection", (reason) => {
  logger.error(
    { err: reason },
    "Unhandled Rejection — keeping server alive but investigate",
  );
});
process.on("uncaughtException", (error) => {
  logger.fatal(
    { err: error },
    "Uncaught Exception — attempting graceful shutdown",
  );
  shutdown("UNCAUGHT_EXCEPTION").catch(() => process.exit(1));
});

// ==========================================
// 🚀 OPTIMIZATION: Server Performance Monitoring
// ==========================================
let requestCount = 0;
const MAX_REQUESTS_PER_CHILD = Number(
  process.env.MAX_REQUESTS_PER_CHILD ?? 5000,
);

app.use((req, res, next) => {
  requestCount++;
  // Graceful reload after reaching max requests
  if (requestCount > MAX_REQUESTS_PER_CHILD) {
    logger.warn(
      `Max requests reached (${MAX_REQUESTS_PER_CHILD}), gracefully shutting down...`,
    );
    res.set("Connection", "close");
    shutdown("MAX_REQUESTS_REACHED").catch(logger.error);
  }
  next();
});

// Monitor memory usage every 30 seconds
const { getPoolStats } = await import("@workspace/db");
const memoryMonitorInterval = setInterval(() => {
  const mem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(2);
  const heapLimitMB = (heapStats.heap_size_limit / 1024 / 1024).toFixed(0);
  const poolStats = getPoolStats();

  // True warning only if memory usage exceeds 80% of the actual V8 heap limit AND used > 400MB
  const isHighMemory =
    mem.heapUsed > 400 * 1024 * 1024 &&
    mem.heapUsed / heapStats.heap_size_limit > 0.8;

  if (isHighMemory) {
    logger.warn(
      {
        memory: {
          heapUsedMB: `${heapUsedMB} MB`,
          heapTotalMB: `${heapTotalMB} MB`,
          heapLimitMB: `${heapLimitMB} MB`,
          usagePct: `${((mem.heapUsed / heapStats.heap_size_limit) * 100).toFixed(1)}%`,
        },
        pool: poolStats,
        requests: requestCount,
      },
      "🔴 High memory usage detected",
    );
  }

  // Debug logging in development
  if (process.env.LOG_LEVEL === "debug") {
    logger.debug(
      {
        memory: {
          heapUsedMB,
          heapTotalMB,
          externalMB: (mem.external / 1024 / 1024).toFixed(2),
          rss: (mem.rss / 1024 / 1024).toFixed(2),
        },
        pool: poolStats,
        requests: requestCount,
        uptime: Math.floor(process.uptime()),
      },
      "Server stats",
    );
  }
}, 30000); // Every 30 seconds

// ==========================================
// ✅ START SERVER LOGIC
// ==========================================
async function start(): Promise<void> {
  logger.info("Checking database connection health...");

  // فحص حالة الداتابيز قبل البدء (Increased timeout to 30s to allow remote DBs to wake up)
  let dbCheck: { ok: boolean; latencyMs: number; error?: string };
  try {
    dbCheck = await Promise.race([
      healthCheck() as Promise<{
        ok: boolean;
        latencyMs: number;
        error?: string;
      }>,
      new Promise<{ ok: boolean; latencyMs: number; error?: string }>(
        (resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: false,
                latencyMs: 30000,
                error: "Database connection timeout after 30s",
              }),
            30000,
          ),
      ),
    ]);
  } catch (err: any) {
    dbCheck = { ok: false, latencyMs: 0, error: err.message };
  }

  if (!dbCheck.ok) {
    logger.error(
      { error: dbCheck.error },
      "Critical: Database connection failed during startup, BUT continuing boot for debugging",
    );
  } else {
    logger.info(
      { latency: `${dbCheck.latencyMs}ms` },
      "Database connection established",
    );
  }
  // Ping route moved to app.ts

  try {
    if (dbCheck.ok) {
      await Promise.race([
        runMigrations(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Migrations timeout")), 60000),
        ),
      ]);
      await Promise.race([
        runAutoSeeder(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Seeder timeout")), 60000),
        ),
      ]);
    }
  } catch (err) {
    logger.error(
      { err },
      "Startup DB task failed/timed out, continuing boot...",
    );
  }

  const httpPort = Number(process.env.PORT || 4000);

  server.listen(httpPort, "0.0.0.0", async () => {
    logger.info(`🚀 Main API HTTP listening on ${httpPort}`);

    // Start Queue workers
    try {
      startAllWorkers();
    } catch (err) {
      logger.error({ err }, "Failed to start queue workers");
    }
    
    // Start Housekeeping Cron Job
    try {
      const { initHousekeepingCron } = await import("./lib/housekeeping-cron.js");
      initHousekeepingCron();
    } catch (err) {
      logger.error({ err }, "Failed to start housekeeping cron job");
    }

    // 2. Start PMS V2.1 Servers (they bind to 10006 locally)
    startAllPmsServers(app).catch((err) => {
      logger.error({ err }, "Failed to start PMS Servers (async caught)");
    });
  });
}

// بدء التشغيل ومعالجة أي خطأ كارثي
start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
