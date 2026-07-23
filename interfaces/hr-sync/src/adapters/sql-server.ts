import * as sql from "mssql";
import { SqlServerConfig, HousingEmployee, mapFields } from "../config.js";
import { log } from "../logger.js";

export async function fetchFromSqlServer(cfg: SqlServerConfig): Promise<HousingEmployee[]> {
  log.info(`[SQL] Connecting to: ${cfg.server}\\${cfg.database}`);

  const poolConfig: sql.config = {
    server: cfg.server,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    port: cfg.port || 1433,
    options: {
      encrypt: cfg.encrypt ?? false,
      trustServerCertificate: cfg.trust_server_certificate ?? true,
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  };

  let pool: sql.ConnectionPool | null = null;
  try {
    pool = await sql.connect(poolConfig);
    log.info(`[SQL] Connected successfully.`);

    const result = await pool.request().query(cfg.query);
    const rows = result.recordset;
    log.info(`[SQL] Query returned ${rows.length} rows.`);

    return rows.map((row: any) => mapFields(row, cfg.field_map)) as HousingEmployee[];
  } finally {
    if (pool) {
      await pool.close();
      log.debug(`[SQL] Connection closed.`);
    }
  }
}
