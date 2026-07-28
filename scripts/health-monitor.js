#!/usr/bin/env node

/**
 * 🚀 Health Monitor Service for Sunrise Housing
 *
 * Monitors:
 * - Server availability
 * - Response times
 * - Memory usage
 * - Database connection pool
 *
 * Alerts on issues
 */

const http = require("http");

const API_URL = process.env.API_URL || "http://localhost:5000";
const CHECK_INTERVAL_MS = parseInt(
  process.env.CHECK_INTERVAL_MS || "30000",
  10,
);
const HEALTH_CHECK_ENDPOINT = "/api/health";

let lastCheck = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level,
      service: "health-monitor",
      message,
      ...data,
    }),
  );
}

async function checkHealth() {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const options = {
      hostname: new URL(API_URL).hostname,
      port: new URL(API_URL).port,
      path: HEALTH_CHECK_ENDPOINT,
      method: "GET",
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        try {
          const body = JSON.parse(data);
          resolve({
            success: statusCode === 200 && body.status === "ok",
            statusCode,
            duration,
            body,
          });
        } catch {
          resolve({
            success: statusCode === 200,
            statusCode,
            duration,
            body: null,
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        statusCode: 0,
        duration: Date.now() - startTime,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        statusCode: 0,
        duration: Date.now() - startTime,
        error: "Timeout",
      });
    });

    req.end();
  });
}

async function monitorHealth() {
  const result = await checkHealth();

  if (result.success) {
    consecutiveFailures = 0;
    log("info", "✅ Health check passed", {
      duration: result.duration,
      pool: result.body?.pool,
      memory: result.body?.memory,
    });
  } else {
    consecutiveFailures++;
    log(
      "warn",
      `❌ Health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
      {
        statusCode: result.statusCode,
        duration: result.duration,
        error: result.error,
      },
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log("error", "🚨 Server is DOWN - Multiple consecutive failures", {
        failures: consecutiveFailures,
        lastError: result.error,
      });
      // Could trigger alert/notification here
      // Example: send Slack notification, create incident, etc.
    }
  }

  lastCheck = result;
}

// Start monitoring
log("info", "Health monitor started", {
  apiUrl: API_URL,
  checkInterval: CHECK_INTERVAL_MS,
  endpoint: HEALTH_CHECK_ENDPOINT,
});

// Initial check
monitorHealth();

// Periodic checks
setInterval(() => {
  monitorHealth();
}, CHECK_INTERVAL_MS);

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "Health monitor shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("info", "Health monitor terminating");
  process.exit(0);
});
