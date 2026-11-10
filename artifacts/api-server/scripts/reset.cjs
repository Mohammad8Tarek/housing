const bcrypt = require('bcryptjs'); 
const { Client } = require('pg'); 
const client = new Client((process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL"); })())); 
async function run() { 
  await client.connect(); 
  const hash = await bcrypt.hash('123456', 12); 
  await client.query("UPDATE taal_housing.employee_portal_accounts SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE employee_id = '10575'", [hash]); 
  console.log('Password reset to 123456'); 
  await client.end(); 
} 
run().catch(console.error);
