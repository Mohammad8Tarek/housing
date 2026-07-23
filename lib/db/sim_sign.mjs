import pg from "pg";

async function run() {
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin123@localhost:5432/staff-housing' });
  const client = await pool.connect();

  const requestId = 3; // The request
  const user = { userId: 8, isSystemAdmin: false, propertyId: 1, roles: ['manager'], jobTitle: 'accounts_manager', username: 'ahmed' };
  
  try {
    await client.query("BEGIN");

    let lockRes = await client.query(
      "SELECT id, status, current_step_order FROM public.family_visit_requests WHERE id = $1 AND property_id = $2 FOR UPDATE",
      [requestId, user.propertyId]
    );
    
    if (lockRes.rows.length === 0) {
      console.log("Request not found or access denied");
      return;
    }

    const request = lockRes.rows[0];
    console.log("Request status:", request.status);
    console.log("Current step order:", request.current_step_order);
    
    const stepOrder = request.current_step_order;
    const STEP_ROLES = { 1: "housing_manager", 2: "hr_manager", 3: "accounts_manager" };
    const requiredRole = STEP_ROLES[stepOrder];
    
    const hasRole = user.jobTitle === requiredRole || user.roles.includes(requiredRole);
    // User 8 has 'hosting_requests.approve' permission, so canApproveByPermission is true
    const canApproveByPermission = true;
    
    if (!hasRole && !user.isSystemAdmin && !canApproveByPermission) {
      console.log(`Only ${requiredRole} can sign this step`);
      return;
    }
    
    console.log("Permission granted.");
    
    const sigRes = await client.query(
      "SELECT signature_image_url FROM public.user_signatures WHERE user_id = $1",
      [user.userId]
    );
    if (sigRes.rows.length === 0 || !sigRes.rows[0].signature_image_url) {
      console.log("No signature");
      return;
    }
    
    console.log("Signature found.");
    
    const stepRes = await client.query(
      "SELECT id, status FROM public.family_visit_approval_steps WHERE request_id = $1 AND step_order = $2",
      [requestId, stepOrder]
    );
    if (stepRes.rows.length === 0) {
      console.log("Approval step not found");
      return;
    }
    if (stepRes.rows[0].status !== "pending") {
      console.log("This step has already been signed. Status:", stepRes.rows[0].status);
      return;
    }
    
    console.log("Step is pending. Ready to sign!");
    
    await client.query("ROLLBACK");
  } catch (e) {
    console.error(e);
    await client.query("ROLLBACK");
  } finally {
    client.release();
    pool.end();
  }
}

run();
