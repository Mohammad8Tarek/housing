import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runAutoSeeder() {
  const seedFilePath = path.resolve(__dirname, "../../seed-data.json");
  const doneFilePath = path.resolve(__dirname, "../../seed-data.json.done");

  if (!fs.existsSync(seedFilePath) || fs.existsSync(doneFilePath)) {
    return;
  }

  logger.info("Starting automatic data migration from seed-data.json...");

  try {
    const rawData = fs.readFileSync(seedFilePath, "utf-8");
    const dumpData = JSON.parse(rawData);
    const tables = Object.keys(dumpData);

    logger.info(`Found ${tables.length} tables to seed.`);

    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");

      for (const table of tables) {
        const rows = dumpData[table];
        if (rows.length === 0) continue;

        // Truncate before insert to avoid duplicates
        await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);

        const columns = Object.keys(rows[0]);
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);

          const values: any[] = [];
          const valuePlaceholders: string[] = [];

          let paramIndex = 1;
          for (const row of batch) {
            const rowPlaceholders: string[] = [];
            for (const col of columns) {
              values.push(row[col]);
              rowPlaceholders.push(`$${paramIndex++}`);
            }
            valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
          }

          const insertQuery = `
            INSERT INTO "${table}" ("${columns.join('", "')}")
            VALUES ${valuePlaceholders.join(", ")}
          `;

          await client.query(insertQuery, values);
        }
        logger.info(`Seeded ${rows.length} rows into ${table}.`);
      }

      await client.query("SET session_replication_role = 'origin';");

      logger.info("Updating sequences...");
      for (const table of tables) {
        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id)+1 FROM "${table}"), 1), false);
          `);
        } catch (err) {}
      }
    } finally {
      client.release();
    }

    fs.renameSync(seedFilePath, doneFilePath);
    logger.info(
      "✅ Seeding completed successfully. File renamed to seed-data.json.done",
    );
  } catch (err) {
    logger.error({ err }, "❌ Failed to run auto-seeder");
  }
}
