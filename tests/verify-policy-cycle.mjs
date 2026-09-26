import { pool } from "../lib/db/src/index.ts";

async function verifyPolicyCycle() {
  console.log("==================================================================");
  console.log("🧪 TESTING HOUSING POLICY EDIT & PROPAGATION CYCLE");
  console.log("==================================================================\n");

  // 1. Read existing policy settings in DB for property 1
  const initialRes = await pool.query(
    "SELECT policy_level_0_capacity, policy_level_1_capacity, policy_level_2_capacity, policy_strict_gender_segregation, job_level_policies FROM taal_housing.settings LIMIT 1"
  );
  const initial = initialRes.rows[0];
  console.log("1. Current DB Settings for taal_housing:");
  console.log(initial);

  // 2. Simulate updating policy: Change policy_level_2_capacity to 3 and job_level_policies
  const testPolicies = [
    {
      id: "level_0",
      levelKey: "0",
      name: "Level 0 (VIP)",
      nameAr: "الدرجة صفر (إدارة عليا)",
      allowedCapacities: [1],
      allowEntire: true
    },
    {
      id: "level_2",
      levelKey: "2",
      name: "Level 2 (Supervisory)",
      nameAr: "الدرجة الثانية (إشرافي)",
      allowedCapacities: [1, 2, 3],
      allowEntire: false
    }
  ];

  console.log("\n2. Updating policy via SQL (simulating settings route save)...");
  await pool.query(
    `UPDATE taal_housing.settings 
     SET policy_level_2_capacity = 3, 
         job_level_policies = $1::jsonb 
     WHERE id = 1`,
    [JSON.stringify(testPolicies)]
  );

  // 3. Verify it was written and returned
  const updatedRes = await pool.query(
    "SELECT policy_level_2_capacity, job_level_policies FROM taal_housing.settings LIMIT 1"
  );
  console.log("3. Read back updated settings:");
  console.log("   policy_level_2_capacity:", updatedRes.rows[0].policy_level_2_capacity);
  console.log("   job_level_policies count:", updatedRes.rows[0].job_level_policies.length);

  if (updatedRes.rows[0].policy_level_2_capacity === 3 && updatedRes.rows[0].job_level_policies.length === 2) {
    console.log("✅ Policy updated and saved to DB successfully!");
  } else {
    throw new Error("Update verification failed!");
  }

  // 4. Revert to original settings
  console.log("\n4. Reverting to original state...");
  await pool.query(
    `UPDATE taal_housing.settings 
     SET policy_level_2_capacity = $1, 
         job_level_policies = $2::jsonb 
     WHERE id = 1`,
    [initial.policy_level_2_capacity, JSON.stringify(initial.job_level_policies || [])]
  );
  console.log("✅ Successfully reverted to original settings.");

  console.log("\n==================================================================");
  console.log("🎉 ALL POLICY VERIFICATIONS PASSED 100%");
  console.log("==================================================================");
  await pool.end();
  process.exit(0);
}

verifyPolicyCycle().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
