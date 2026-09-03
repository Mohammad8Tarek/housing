import { pool } from "@workspace/db";
import { ensureProfileInTargetSchema } from "../src/routes/hosting-requests.js";

async function run() {
  console.log("Starting DB fix...");
  const client = await pool.connect();

  try {
    // 1. Find approved hosting requests
    const res = await client.query(
      "SELECT * FROM public.hosting_requests WHERE status = 'approved'"
    );
    console.log(`Found ${res.rows.length} approved requests.`);

    for (const req of res.rows) {
      console.log(`Checking request ${req.request_number} (ID: ${req.id})...`);
      
      const targetPropId = req.visit_hotel_id || req.property_id;
      
      if (!req.guest_hosting_id) {
        console.log(`  - No guest_hosting_id found! Creating in target property ${targetPropId}...`);
        
        await client.query("BEGIN");
        try {
          const profileCheck = await ensureProfileInTargetSchema(
            client,
            req.property_id,
            targetPropId,
            req.clock_number
          );
          
          if (profileCheck && profileCheck.profileId) {
            const { profileId, targetSchema: schemaName } = profileCheck;
            const hostingRes = await client.query(
              `INSERT INTO "${schemaName}".hostings
               (profile_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status, room_id)
               VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'APPROVED', $7)
               RETURNING id`,
              [
                profileId,
                req.family_members_count,
                req.from_date,
                req.to_date,
                req.remarks || "",
                "system-fix",
                req.assigned_room_id || null,
              ]
            );
            
            const newHostingId = hostingRes.rows[0].id;
            await client.query(
              "UPDATE public.hosting_requests SET guest_hosting_id = $1 WHERE id = $2",
              [newHostingId, req.id]
            );
            await client.query("COMMIT");
            console.log(`  - SUCCESS: Created guest_hosting_id = ${newHostingId} in schema ${schemaName}.`);
          } else {
            await client.query("ROLLBACK");
            console.log(`  - FAILED: Could not find or copy profile ${req.clock_number}.`);
          }
        } catch (e: any) {
          await client.query("ROLLBACK").catch(() => {});
          console.error(`  - ERROR during creation:`, e.message);
        }
      } else {
        console.log(`  - guest_hosting_id = ${req.guest_hosting_id} exists. Checking if it's in the WRONG schema...`);
        // If the target schema is different from the base schema, it might have been created in the base schema by mistake (old bug)
        if (targetPropId !== req.property_id) {
          const wrongSchema = `prop_${req.property_id}`;
          const checkWrong = await client.query(`SELECT id FROM "${wrongSchema}".hostings WHERE id = $1`, [req.guest_hosting_id]);
          
          if (checkWrong.rows.length > 0) {
            console.log(`  - WARNING: Found in wrong schema (${wrongSchema}). Moving it...`);
            
            await client.query("BEGIN");
            try {
              // Create it in the correct schema
              const profileCheck = await ensureProfileInTargetSchema(
                client,
                req.property_id,
                targetPropId,
                req.clock_number
              );
              
              if (profileCheck && profileCheck.profileId) {
                const { profileId, targetSchema: rightSchema } = profileCheck;
                const hostingRes = await client.query(
                  `INSERT INTO "${rightSchema}".hostings
                   (profile_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status, room_id)
                   VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'APPROVED', $7)
                   RETURNING id`,
                  [
                    profileId,
                    req.family_members_count,
                    req.from_date,
                    req.to_date,
                    req.remarks || "",
                    "system-fix",
                    req.assigned_room_id || null,
                  ]
                );
                
                const newHostingId = hostingRes.rows[0].id;
                
                // Update request
                await client.query(
                  "UPDATE public.hosting_requests SET guest_hosting_id = $1 WHERE id = $2",
                  [newHostingId, req.id]
                );
                
                // Delete from wrong schema
                await client.query(`DELETE FROM "${wrongSchema}".hostings WHERE id = $1`, [req.guest_hosting_id]);
                
                await client.query("COMMIT");
                console.log(`  - SUCCESS: Moved to ${rightSchema} with new guest_hosting_id = ${newHostingId}.`);
              } else {
                await client.query("ROLLBACK");
                console.log(`  - FAILED to move: Could not ensure profile in ${targetPropId}.`);
              }
            } catch(e: any) {
              await client.query("ROLLBACK").catch(() => {});
              console.error(`  - ERROR during move:`, e.message);
            }
          } else {
            console.log(`  - It is NOT in the wrong schema. Looks good.`);
          }
        } else {
            console.log(`  - Target is base property. Looks good.`);
        }
      }
    }

  } catch (e) {
    console.error("Fatal Error:", e);
  } finally {
    client.release();
    console.log("DB fix complete.");
    process.exit(0);
  }
}

run();
