import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:admin123@localhost:5432/staff-housing";
const pool = new Pool({ connectionString: DATABASE_URL });

async function renameSchemas() {
  console.log("🚀 Starting Schema Renaming Process...");
  const client = await pool.connect();

  try {
    // Ensure column exists
    await client.query("ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS schema_name TEXT UNIQUE");

    const res = await client.query("SELECT id, name FROM public.properties");
    
    for (const prop of res.rows) {
      const newName = prop.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
        
      const oldName = `prop_${prop.id}`;

      console.log(`\n🔄 Processing [${prop.name}]: Renaming '${oldName}' -> '${newName}'`);
      
      try {
        await client.query(`ALTER SCHEMA "${oldName}" RENAME TO "${newName}"`);
        await client.query(`UPDATE public.properties SET schema_name = $1 WHERE id = $2`, [newName, prop.id]);
        console.log(`   ✅ Renamed successfully!`);
      } catch (err) {
        if (err.message.includes("does not exist")) {
          // Schema might have been renamed already
          await client.query(`UPDATE public.properties SET schema_name = $1 WHERE id = $2`, [newName, prop.id]);
          console.log(`   ⚠️ Schema '${oldName}' not found. Updated property record anyway.`);
        } else {
          console.error(`   ❌ Error:`, err.message);
        }
      }
    }
    
    console.log("\n🎉 Schema names updated successfully!");
  } catch (err) {
    console.error("Critical Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

renameSchemas();
