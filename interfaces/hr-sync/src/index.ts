import * as cron from "node-cron";
import { loadConfig, AppConfig, HousingEmployee } from "./config.js";
import { initLogger, log } from "./logger.js";
import { fetchFromRestApi } from "./adapters/rest-api.js";
import { fetchFromSqlServer } from "./adapters/sql-server.js";
import { fetchFromCsvExcel, watchFolder } from "./adapters/csv-excel.js";
import { runSync, SyncResult } from "./sync.js";
import { sendWebhookNotification } from "./notifier.js";

const BANNER = `
╔═══════════════════════════════════════════════════════════╗
║        🏨 Sunrise Housing - HR Sync Interface             ║
║        Version 1.0.0                                       ║
╚═══════════════════════════════════════════════════════════╝
`;

async function fetchEmployees(config: AppConfig): Promise<HousingEmployee[]> {
  const mode = config.sync.mode;
  switch (mode) {
    case "rest_api":
      return fetchFromRestApi(config.rest_api);
    case "sql_server":
      return fetchFromSqlServer(config.sql_server);
    case "csv_excel":
      return fetchFromCsvExcel(config.csv_excel);
    default:
      throw new Error(`Unknown sync mode: ${mode}. Must be 'rest_api', 'sql_server', or 'csv_excel'.`);
  }
}

function printResult(result: SyncResult) {
  log.separator();
  log.info(`📊 Sync Result:`);
  log.info(`   Total Fetched : ${result.total}`);
  log.info(`   ✅ Created    : ${result.created}`);
  log.info(`   🔄 Updated    : ${result.updated}`);
  log.info(`   ⏭️  Skipped    : ${result.skipped}`);
  log.info(`   ⏱️  Duration   : ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.errors.length > 0) {
    log.warn(`   ❌ Errors     : ${result.errors.length}`);
    result.errors.forEach((e) => log.error(`      → ${e}`));
  } else {
    log.info(`   🎉 Status     : SUCCESS`);
  }
  log.separator();
}

async function doSync(config: AppConfig, label: string = "Manual") {
  log.info(`\n▶ Starting sync [${label}] — Mode: ${config.sync.mode.toUpperCase()}`);
  try {
    const employees = await fetchEmployees(config);
    const result = await runSync(config, employees);
    printResult(result);
    await sendWebhookNotification(config.notifications, result, config.sync.mode);
  } catch (err: any) {
    log.error(`[SYNC ERROR] ${err.message}`);
    if (err.stack) log.debug(err.stack);
  }
}

async function main() {
  console.log(BANNER);

  const config = loadConfig();
  initLogger(config.logging.level, config.logging.log_file);

  log.info(`🔧 Configuration:`);
  log.info(`   Mode          : ${config.sync.mode}`);
  log.info(`   Housing API   : ${config.housing_api.url}`);
  log.info(`   Property ID   : ${config.housing_api.property_id}`);
  log.info(`   Interval      : Every ${config.sync.interval_minutes} minute(s)`);
  log.info(`   Auto Start    : ${config.sync.auto_start}`);
  log.info(`   Dry Run       : ${config.sync.dry_run}`);
  log.separator();

  // Handle command-line arguments
  const args = process.argv.slice(2);
  if (args.includes("--once") || args.includes("-1")) {
    // Run once and exit
    log.info("📌 Single run mode (--once flag detected)");
    await doSync(config, "Single Run");
    process.exit(0);
  }

  if (args.includes("--test")) {
    // Test connection only
    log.info("🔍 Testing connection...");
    try {
      const employees = await fetchEmployees(config);
      log.info(`✅ Connection OK! Fetched ${employees.length} employees.`);
      if (employees.length > 0) {
        log.info(`   Sample record: ${JSON.stringify(employees[0], null, 2)}`);
      }
    } catch (err: any) {
      log.error(`❌ Connection FAILED: ${err.message}`);
    }
    process.exit(0);
  }

  // Watch folder mode for CSV/Excel
  if (config.sync.mode === "csv_excel" && config.csv_excel.watch_folder) {
    log.info(`👁️  Folder watch mode active: ${config.csv_excel.watch_folder}`);
    watchFolder(config.csv_excel, async (employees) => {
      log.info(`[Watch] New file detected — ${employees.length} employees to sync.`);
      const result = await runSync(config, employees);
      printResult(result);
      await sendWebhookNotification(config.notifications, result, "csv_watch");
    });
  }

  // Auto start first sync
  if (config.sync.auto_start) {
    await doSync(config, "Auto Start");
  } else {
    log.info("⏸️  Auto start is disabled. Waiting for scheduled runs...");
  }

  // Schedule recurring sync
  const intervalMin = config.sync.interval_minutes;
  if (intervalMin > 0) {
    // Build cron expression: every N minutes
    const cronExpr =
      intervalMin < 60
        ? `*/${intervalMin} * * * *`
        : `0 */${Math.floor(intervalMin / 60)} * * *`;

    log.info(`⏰ Scheduler started: runs every ${intervalMin} minute(s) (cron: ${cronExpr})`);

    cron.schedule(cronExpr, async () => {
      await doSync(config, "Scheduled");
    });
  } else {
    log.warn("⚠️  interval_minutes is 0 — scheduler is disabled. Use --once to sync manually.");
  }

  log.info(`\n✅ HR Sync Interface is running. Press Ctrl+C to stop.\n`);
  log.info(`   Commands while running:`);
  log.info(`     Ctrl+C  →  Graceful shutdown`);
  log.info(`\n   Or run with flags:`);
  log.info(`     --once   →  Sync once and exit`);
  log.info(`     --test   →  Test connection only\n`);

  // Graceful shutdown
  process.on("SIGINT", () => {
    log.info("\n👋 Shutting down HR Sync Interface...");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log.info("\n👋 Received SIGTERM. Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
