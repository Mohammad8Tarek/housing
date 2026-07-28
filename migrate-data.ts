import { Client } from "pg";

const LOCAL_DB_URL =
  "postgresql://postgres:admin123@localhost:5432/staff-housing";
const REMOTE_DB_URL =
  "postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function migrate() {
  const local = new Client({ connectionString: LOCAL_DB_URL });
  const remote = new Client({ connectionString: REMOTE_DB_URL });

  await local.connect();
  await remote.connect();

  console.log("Connected to both databases.");

  // Get all table names from local database public schema
  const { rows: tables } = await local.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != 'drizzle_migrations'
  `);

  console.log(`Found ${tables.length} tables to migrate.`);

  const tableNames = tables.map((t) => t.table_name);

  // TRUNCATE ALL TABLES
  console.log("Truncating remote tables...");
  for (const tableName of tableNames) {
    try {
      await remote.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
      console.log(`  - Truncated ${tableName}`);
    } catch (e: any) {
      console.warn(
        `  - Could not truncate ${tableName} (might not exist in remote)`,
      );
    }
  }

  // Load all data into memory
  const allData: Record<string, any[]> = {};
  for (const tableName of tableNames) {
    const { rows } = await local.query(`SELECT * FROM "${tableName}"`);
    if (rows.length > 0) {
      allData[tableName] = rows;
    }
  }

  const tablesToProcess = Object.keys(allData);
  let remainingTables = [...tablesToProcess];

  let passesWithoutProgress = 0;

  while (remainingTables.length > 0) {
    const nextRemaining = [];
    let processedAny = false;

    for (const tableName of remainingTables) {
      console.log(`Attempting to migrate table: ${tableName}`);

      // Get target columns
      const { rows: colRows } = await remote.query(
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `,
        [tableName],
      );
      const validColumns = new Set(colRows.map((r) => r.column_name));

      const rows = allData[tableName];
      const sourceColumns = Object.keys(rows[0]);
      const columns = sourceColumns.filter((c) => validColumns.has(c));
      const columnNames = columns.map((c) => `"${c}"`).join(", ");

      try {
        await remote.query("BEGIN");

        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);

          const valuesArr = [];
          let paramIndex = 1;
          const queryParams = [];

          for (const row of chunk) {
            const placeholders = columns
              .map(() => `$${paramIndex++}`)
              .join(", ");
            valuesArr.push(`(${placeholders})`);

            for (const col of columns) {
              queryParams.push(row[col]);
            }
          }

          const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES ${valuesArr.join(", ")}`;
          await remote.query(insertQuery, queryParams);
        }

        await remote.query("COMMIT");
        console.log(`  - ✅ Successfully migrated ${tableName}`);
        processedAny = true;
      } catch (error: any) {
        await remote.query("ROLLBACK");
        if (error.code === "23503") {
          // foreign_key_violation
          console.log(
            `  - ⏳ Postponed ${tableName} due to foreign key constraints.`,
          );
          nextRemaining.push(tableName);
        } else {
          console.error(
            `  - ❌ Failed ${tableName} with unexpected error:`,
            error.message,
          );
          nextRemaining.push(tableName);
        }
      }
    }

    if (!processedAny) {
      passesWithoutProgress++;
      if (passesWithoutProgress > 2) {
        console.error(
          "Stuck in a loop due to circular foreign keys or errors. Aborting.",
        );
        break;
      }
    } else {
      passesWithoutProgress = 0;
    }

    remainingTables = nextRemaining;
  }

  // Update sequences
  console.log("Updating sequences...");
  for (const tableName of tableNames) {
    try {
      await remote.query(
        `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id)+1 FROM "${tableName}"), 1), false);`,
      );
    } catch (e) {
      // Ignored
    }
  }

  console.log("Migration complete.");
  await local.end();
  await remote.end();
}

migrate().catch(console.error);
