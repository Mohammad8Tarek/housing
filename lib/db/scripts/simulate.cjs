const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/housing_db' });

async function run() {
    try {
        const res = await pool.query("SELECT * FROM public.hosting_requests ORDER BY id DESC LIMIT 1");
        const req = res.rows[0];
        console.log("Latest HR:", req.id, req.request_number);
        console.log("property_id:", req.property_id);
        console.log("visit_hotel_id:", req.visit_hotel_id);
        console.log("guest_hosting_id:", req.guest_hosting_id);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
