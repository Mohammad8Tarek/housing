import axios from "axios";
import { AppConfig, HousingEmployee } from "./config.js";
import { log } from "./logger.js";

export interface SyncResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

const BATCH_SIZE = 50; // Send employees in batches of 50

async function sendBatch(
  employees: HousingEmployee[],
  config: AppConfig
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const { url, api_key, property_id } = config.housing_api;

  try {
    const response = await axios.post(
      `${url}/api/hr-sync/receive`,
      { propertyId: property_id, employees },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": api_key,
        },
        timeout: 60000,
      }
    );

    const data = response.data;
    return {
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
      errors: data.errors || [],
    };
  } catch (err: any) {
    const detail = err.response?.data?.error || err.message;
    throw new Error(`Housing API error: ${detail}`);
  }
}

export async function runSync(config: AppConfig, employees: HousingEmployee[]): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    total: employees.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  };

  if (employees.length === 0) {
    log.warn("[Sync] No employees to sync.");
    result.success = true;
    result.durationMs = Date.now() - startTime;
    return result;
  }

  if (config.sync.dry_run) {
    log.warn("[Sync] DRY RUN mode — NOT sending to Housing system.");
    log.info(`[Sync] Would have sent ${employees.length} employees.`);
    employees.slice(0, 5).forEach((emp, i) => {
      log.debug(`  [${i + 1}] ${emp.employeeId} - ${emp.firstName} ${emp.lastName} (${emp.department})`);
    });
    if (employees.length > 5) log.debug(`  ... and ${employees.length - 5} more.`);
    result.success = true;
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // Split into batches
  const batches: HousingEmployee[][] = [];
  for (let i = 0; i < employees.length; i += BATCH_SIZE) {
    batches.push(employees.slice(i, i + BATCH_SIZE));
  }

  log.info(`[Sync] Sending ${employees.length} employees in ${batches.length} batch(es) to: ${config.housing_api.url}`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log.info(`[Sync] Batch ${i + 1}/${batches.length} (${batch.length} employees)...`);
    try {
      const batchResult = await sendBatch(batch, config);
      result.created += batchResult.created;
      result.updated += batchResult.updated;
      result.skipped += batchResult.skipped;
      if (batchResult.errors.length > 0) {
        result.errors.push(...batchResult.errors);
      }
      log.info(
        `[Sync] Batch ${i + 1} done → Created: ${batchResult.created}, Updated: ${batchResult.updated}, Skipped: ${batchResult.skipped}`
      );
    } catch (err: any) {
      const errMsg = `Batch ${i + 1} failed: ${err.message}`;
      log.error(`[Sync] ${errMsg}`);
      result.errors.push(errMsg);
    }
  }

  result.success = result.errors.length === 0;
  result.durationMs = Date.now() - startTime;
  return result;
}
