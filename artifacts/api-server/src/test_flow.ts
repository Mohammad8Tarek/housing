import { pool } from "@workspace/db";
import fetch from "node-fetch"; // or just use pool directly to bypass auth

async function run() {
    const client = await pool.connect();
    try {
        console.log("Checking DB...");
        
        // Find TAAL property id
        const p1 = await client.query("SELECT id FROM public.properties WHERE display_name ILIKE '%TAAL%' LIMIT 1");
        const prop1 = p1.rows[0].id;
        
        // Find Elwaha property id
        const p2 = await client.query("SELECT id FROM public.properties WHERE display_name ILIKE '%Elwaha%' LIMIT 1");
        const prop2 = p2.rows[0].id;
        
        console.log(`TAAL: ${prop1}, Elwaha: ${prop2}`);
        
        // Check latest hosting request
        const hr = await client.query("SELECT * FROM public.hosting_requests ORDER BY id DESC LIMIT 1");
        console.log("Latest HR:", hr.rows[0]);
        
        if (hr.rows[0]) {
            const req = hr.rows[0];
            console.log(`Request ID: ${req.id}, Guest Hosting ID: ${req.guest_hosting_id}`);
            
            if (req.guest_hosting_id) {
                // Check if it's in prop_2
                try {
                    const hostCheck = await client.query(`SELECT * FROM "prop_${prop2}".hostings WHERE id = $1`, [req.guest_hosting_id]);
                    console.log(`Found in prop_${prop2} (Destination):`, hostCheck.rows.length > 0);
                    
                    const hostCheck1 = await client.query(`SELECT * FROM "prop_${prop1}".hostings WHERE id = $1`, [req.guest_hosting_id]);
                    console.log(`Found in prop_${prop1} (Base):`, hostCheck1.rows.length > 0);
                } catch(e) {
                    console.error(e);
                }
            }
        }
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
