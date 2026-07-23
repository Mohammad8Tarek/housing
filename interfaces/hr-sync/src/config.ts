import * as fs from "fs";
import * as path from "path";

export interface HousingApiConfig {
  url: string;
  api_key: string;
  property_id: number;
}

export interface SyncConfig {
  mode: "rest_api" | "sql_server" | "csv_excel";
  interval_minutes: number;
  auto_start: boolean;
  dry_run: boolean;
}

export interface RestApiConfig {
  url: string;
  method: string;
  auth_type: "bearer" | "basic" | "api_key" | "none";
  token: string;
  basic_user: string;
  basic_pass: string;
  api_key_header: string;
  api_key_value: string;
  response_path: string;
  field_map: Record<string, string>;
}

export interface SqlServerConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  encrypt: boolean;
  trust_server_certificate: boolean;
  query: string;
  field_map: Record<string, string>;
}

export interface CsvExcelConfig {
  file_path: string;
  watch_folder: string;
  file_pattern: string;
  sheet_name: string;
  has_header_row: boolean;
  field_map: Record<string, string>;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  log_file: string;
  max_log_size_mb: number;
  keep_logs_days: number;
}

export interface NotificationsConfig {
  enabled: boolean;
  on_error: boolean;
  on_success: boolean;
  webhook_url: string;
}

export interface AppConfig {
  housing_api: HousingApiConfig;
  sync: SyncConfig;
  rest_api: RestApiConfig;
  sql_server: SqlServerConfig;
  csv_excel: CsvExcelConfig;
  logging: LoggingConfig;
  notifications: NotificationsConfig;
}

// Normalized employee shape (what we send to Housing)
export interface HousingEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  nationality?: string;
  nationalId?: string;
  gender?: string;
  status?: string;
  hireDate?: string;
}

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;

  // Look for config.json next to the exe or in current dir
  const locations = [
    path.join(process.execPath ? path.dirname(process.execPath) : process.cwd(), "config.json"),
    path.join(process.cwd(), "config.json"),
    path.join(__dirname, "..", "config.json"),
  ];

  let configPath: string | null = null;
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      configPath = loc;
      break;
    }
  }

  if (!configPath) {
    console.error("\n❌ ERROR: config.json not found!");
    console.error("   Please copy config.example.json to config.json and fill in your settings.\n");
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    _config = JSON.parse(raw) as AppConfig;
    console.log(`✅ Config loaded from: ${configPath}`);
    return _config;
  } catch (err: any) {
    console.error(`\n❌ ERROR: Could not parse config.json: ${err.message}\n`);
    process.exit(1);
  }
}

export function mapFields(
  record: Record<string, any>,
  fieldMap: Record<string, string>
): Partial<HousingEmployee> {
  const result: Record<string, any> = {};
  for (const [housingField, sourceField] of Object.entries(fieldMap)) {
    if (sourceField && record[sourceField] !== undefined) {
      result[housingField] = record[sourceField];
    }
  }
  return result as Partial<HousingEmployee>;
}
