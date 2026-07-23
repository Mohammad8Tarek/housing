import axios from "axios";
import { RestApiConfig, HousingEmployee, mapFields } from "../config.js";
import { log } from "../logger.js";

function getHeaders(cfg: RestApiConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  switch (cfg.auth_type) {
    case "bearer":
      headers["Authorization"] = `Bearer ${cfg.token}`;
      break;
    case "basic": {
      const encoded = Buffer.from(`${cfg.basic_user}:${cfg.basic_pass}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
      break;
    }
    case "api_key":
      headers[cfg.api_key_header || "X-Api-Key"] = cfg.api_key_value;
      break;
    case "none":
    default:
      break;
  }
  return headers;
}

function getByPath(obj: any, dotPath: string): any {
  if (!dotPath) return obj;
  return dotPath.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
}

export async function fetchFromRestApi(cfg: RestApiConfig): Promise<HousingEmployee[]> {
  log.info(`[REST] Connecting to: ${cfg.url}`);

  const response = await axios({
    method: cfg.method || "GET",
    url: cfg.url,
    headers: getHeaders(cfg),
    timeout: 30000,
  });

  log.info(`[REST] Response status: ${response.status}`);

  const rawData = cfg.response_path ? getByPath(response.data, cfg.response_path) : response.data;

  if (!Array.isArray(rawData)) {
    throw new Error(
      `[REST] Expected an array of employees but got: ${typeof rawData}. ` +
        `Check 'response_path' in config. Response keys: ${Object.keys(response.data || {}).join(", ")}`
    );
  }

  log.info(`[REST] Fetched ${rawData.length} employee records.`);

  return rawData.map((record: any) => mapFields(record, cfg.field_map)) as HousingEmployee[];
}
