import { createRequire } from "module";
const require = createRequire(import.meta.resolve("../lib/db/package.json"));
const pg = require("pg");
const bcrypt = require("bcryptjs");

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:admin123@localhost:5432/staff-housing";
const API_URL = "http://localhost:4000";
const TEST_PASSWORD = "Password@123!";

const ALL_MODULES = [
  "dashboard", "housing", "housekeeping", "profiles", "accommodation",
  "reservations", "hosting_requests", "guest_hosting", "maintenance",
  "reports", "users", "settings", "activity_log", "properties", "documents",
  "evaluations", "portal_content", "activities", "smart_locks", "whatsapp",
  "inventory", "workers", "hr_sync", "portal_notifications", "gate"
];

const MODULE_ACTIONS = {
  dashboard: ["view"],
  housing: ["view", "create", "edit", "delete", "export"],
  housekeeping: ["view", "edit", "export"],
  profiles: ["view", "create", "edit", "delete", "export", "reset_password", "view_sensitive"],
  accommodation: ["view", "create", "edit", "checkout", "transfer", "export", "override_single_occupancy"],
  reservations: ["view", "create", "edit", "checkin", "delete", "export", "override_single_occupancy"],
  hosting_requests: ["view", "create", "edit", "delete", "approve"],
  guest_hosting: ["view", "create", "edit", "checkin", "checkout", "delete", "export"],
  maintenance: ["view", "create", "edit", "delete", "export"],
  reports: ["view", "export", "audit"],
  users: ["view", "create", "edit", "delete", "export", "reset_password", "manage_permissions", "unlock"],
  settings: ["view", "create", "edit", "delete"],
  activity_log: ["view", "export", "audit"],
  properties: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "delete"],
  evaluations: ["view", "create", "edit", "delete", "export"],
  portal_content: ["view", "create", "edit", "delete"],
  activities: ["view", "create", "edit", "delete", "publish"],
  smart_locks: ["view", "create", "edit", "unlock"],
  whatsapp: ["view", "create", "edit", "export"],
  inventory: ["view", "create", "edit", "delete", "export"],
  workers: ["view", "create", "edit", "delete", "export"],
  hr_sync: ["view", "edit", "export"],
  portal_notifications: ["view", "create", "delete"],
  gate: ["view", "create", "export"],
};

function allModulePerms(mod) {
  return (MODULE_ACTIONS[mod] || []).map(act => `${mod}.${act}`);
}

const TEST_USERS_SPECS = [
  {
    username: "test_superadmin",
    roles: ["super_admin"],
    propertyId: 1,
    propertyIds: [1, 2, 7],
    permissions: ALL_MODULES.flatMap(allModulePerms),
    description: "Super Admin (Global full control across all properties)"
  },
  {
    username: "test_manager",
    roles: ["manager"],
    propertyId: 1,
    propertyIds: [1],
    permissions: [
      "dashboard.view",
      ...allModulePerms("housing"),
      ...allModulePerms("housekeeping"),
      ...allModulePerms("profiles"),
      ...allModulePerms("accommodation"),
      ...allModulePerms("reservations"),
      ...allModulePerms("hosting_requests"),
      ...allModulePerms("guest_hosting"),
      ...allModulePerms("maintenance"),
      ...allModulePerms("reports"),
      ...allModulePerms("activity_log"),
      ...allModulePerms("documents"),
      ...allModulePerms("inventory"),
      ...allModulePerms("workers"),
      ...allModulePerms("gate")
    ],
    description: "Housing Manager (Operations, Housing, Maintenance, Accommodations - No Users/Settings)"
  },
  {
    username: "test_frontdesk",
    roles: ["receptionist"],
    propertyId: 1,
    propertyIds: [1],
    permissions: [
      "dashboard.view",
      "housing.view",
      "profiles.view",
      ...allModulePerms("reservations"),
      ...allModulePerms("accommodation"),
      ...allModulePerms("guest_hosting"),
      "gate.view"
    ],
    description: "Front Desk (Checkin, Checkout, Reservations, Hosting - No Maintenance, No Users, No Settings)"
  },
  {
    username: "test_maintenance",
    roles: ["maintenance_staff"],
    propertyId: 1,
    propertyIds: [1],
    permissions: [
      "dashboard.view",
      "housing.view",
      ...allModulePerms("maintenance"),
      ...allModulePerms("inventory"),
      ...allModulePerms("workers"),
      "profiles.view",
      "activity_log.view",
      "documents.view"
    ],
    description: "Maintenance Technician (Maintenance work orders, inventory, workers - No Reservations/Users)"
  },
  {
    username: "test_housekeeping",
    roles: ["housekeeping_staff"],
    propertyId: 1,
    propertyIds: [1],
    permissions: [
      "dashboard.view",
      "housing.view",
      ...allModulePerms("housekeeping"),
      ...allModulePerms("inventory"),
      ...allModulePerms("workers"),
      "activity_log.view",
      "documents.view"
    ],
    description: "Housekeeping Staff (Room cleaning & linen orders only - No Maintenance/Reservations)"
  },
  {
    username: "test_prop2_manager",
    roles: ["manager"],
    propertyId: 2,
    propertyIds: [2],
    permissions: [
      "dashboard.view",
      ...allModulePerms("housing"),
      ...allModulePerms("maintenance"),
      ...allModulePerms("profiles")
    ],
    description: "Property 2 Isolated Manager (Access restricted to Property 2 El Waha New)"
  }
];

async function seedTestUsers(pool) {
  console.log("🛠️  1. Seeding test users with deterministic passwords...");
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const u of TEST_USERS_SPECS) {
    // Delete existing user if present
    await pool.query("DELETE FROM public.users WHERE username = $1", [u.username]);

    await pool.query(
      `INSERT INTO public.users (
        username, password_hash, roles, permissions, property_id, property_ids, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())`,
      [
        u.username,
        passwordHash,
        u.roles,
        u.permissions,
        u.propertyId,
        u.propertyIds
      ]
    );
    console.log(`   ✅ Seeded user: ${u.username} (${u.roles.join(",")}) -> Prop ${u.propertyId}`);
  }
}

async function login(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed for ${username}: ${res.status} ${errText}`);
  }

  const setCookie = res.headers.get("set-cookie");
  const data = await res.json();
  return {
    cookie: setCookie ? setCookie.split(";")[0] : "",
    user: data.user
  };
}

async function apiRequest(endpoint, cookie, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(options.headers || {})
    }
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore non-json
  }

  return {
    status: res.status,
    ok: res.ok,
    body
  };
}

async function run() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  
  try {
    await seedTestUsers(pool);

    console.log("\n🔑 2. Testing Authentication & Session issuance for all roles...");
    const sessions = {};
    for (const spec of TEST_USERS_SPECS) {
      try {
        const sess = await login(spec.username, TEST_PASSWORD);
        sessions[spec.username] = sess;
        console.log(`   ✅ Logged in [${spec.username}]: Role=${sess.user.roles[0]}, Perms=${sess.user.permissions?.length || 0}`);
      } catch (err) {
        console.error(`   ❌ Failed to login [${spec.username}]:`, err.message);
      }
    }

    console.log("\n🧪 3. Running Comprehensive Permission Enforcement Matrix (RBAC)...\n");

    const tests = [
      // --- Super Admin ---
      {
        role: "super_admin",
        user: "test_superadmin",
        endpoint: "/api/users",
        method: "GET",
        expectedStatus: 200,
        desc: "Super Admin can view users list"
      },
      {
        role: "super_admin",
        user: "test_superadmin",
        endpoint: "/api/properties",
        method: "GET",
        expectedStatus: 200,
        desc: "Super Admin can view properties list"
      },
      {
        role: "super_admin",
        user: "test_superadmin",
        endpoint: "/api/maintenance?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Super Admin can view maintenance orders in Property 1"
      },

      // --- Housing Manager ---
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/dashboard/stats?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view dashboard stats"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/buildings?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view housing buildings"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/rooms?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view housing rooms"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/assignments?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view in-house accommodations"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/reservations?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view reservations"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/maintenance?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Manager can view maintenance work orders"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/users",
        method: "GET",
        expectedStatus: 403,
        desc: "Manager CANNOT view users management (Forbidden 403)"
      },
      {
        role: "manager",
        user: "test_manager",
        endpoint: "/api/properties",
        method: "POST",
        expectedStatus: 403,
        desc: "Manager CANNOT create new hotels/properties (Forbidden 403)"
      },

      // --- Front Desk (Receptionist without maintenance/housekeeping) ---
      {
        role: "receptionist",
        user: "test_frontdesk",
        endpoint: "/api/reservations?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Front Desk can view reservations"
      },
      {
        role: "receptionist",
        user: "test_frontdesk",
        endpoint: "/api/assignments?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Front Desk can view in-house accommodation"
      },
      {
        role: "receptionist",
        user: "test_frontdesk",
        endpoint: "/api/maintenance?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Front Desk CANNOT view maintenance hub (Forbidden 403)"
      },
      {
        role: "receptionist",
        user: "test_frontdesk",
        endpoint: "/api/users",
        method: "GET",
        expectedStatus: 403,
        desc: "Front Desk CANNOT view users (Forbidden 403)"
      },
      {
        role: "receptionist",
        user: "test_frontdesk",
        endpoint: "/api/settings",
        method: "PATCH",
        expectedStatus: 403,
        desc: "Front Desk CANNOT edit hotel system settings (Forbidden 403)"
      },

      // --- Maintenance Technician ---
      {
        role: "maintenance_staff",
        user: "test_maintenance",
        endpoint: "/api/maintenance?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Maintenance technician CAN view maintenance tickets"
      },
      {
        role: "maintenance_staff",
        user: "test_maintenance",
        endpoint: "/api/workers?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Maintenance technician CAN view workers"
      },
      {
        role: "maintenance_staff",
        user: "test_maintenance",
        endpoint: "/api/reservations?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Maintenance technician CANNOT view reservations (Forbidden 403)"
      },
      {
        role: "maintenance_staff",
        user: "test_maintenance",
        endpoint: "/api/assignments?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Maintenance technician CANNOT view in-house accommodation (Forbidden 403)"
      },
      {
        role: "maintenance_staff",
        user: "test_maintenance",
        endpoint: "/api/users",
        method: "GET",
        expectedStatus: 403,
        desc: "Maintenance technician CANNOT view users (Forbidden 403)"
      },

      // --- Housekeeping Staff ---
      {
        role: "housekeeping_staff",
        user: "test_housekeeping",
        endpoint: "/api/maintenance?propertyId=1",
        method: "GET",
        expectedStatus: 200,
        desc: "Housekeeping staff CAN view housekeeping orders in maintenance hub"
      },
      {
        role: "housekeeping_staff",
        user: "test_housekeeping",
        endpoint: "/api/reservations?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Housekeeping staff CANNOT view reservations (Forbidden 403)"
      },
      {
        role: "housekeeping_staff",
        user: "test_housekeeping",
        endpoint: "/api/assignments?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Housekeeping staff CANNOT view accommodations (Forbidden 403)"
      },
      {
        role: "housekeeping_staff",
        user: "test_housekeeping",
        endpoint: "/api/users",
        method: "GET",
        expectedStatus: 403,
        desc: "Housekeeping staff CANNOT view users (Forbidden 403)"
      },

      // --- Multi-Tenant Property Isolation ---
      {
        role: "manager_prop2",
        user: "test_prop2_manager",
        endpoint: "/api/rooms?propertyId=2",
        method: "GET",
        expectedStatus: 200,
        desc: "Prop 2 Manager can access Property 2 rooms"
      },
      {
        role: "manager_prop2",
        user: "test_prop2_manager",
        endpoint: "/api/rooms?propertyId=1",
        method: "GET",
        expectedStatus: 403,
        desc: "Prop 2 Manager CANNOT access Property 1 rooms (Tenant Isolation 403)"
      }
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const t of tests) {
      const sess = sessions[t.user];
      if (!sess) {
        console.log(`   ❌ [SKIPPED] ${t.desc} (User ${t.user} session missing)`);
        failedCount++;
        continue;
      }

      const res = await apiRequest(t.endpoint, sess.cookie, {
        method: t.method || "GET",
        body: t.method === "POST" || t.method === "PATCH" ? JSON.stringify({}) : undefined
      });
      const isExpected = res.status === t.expectedStatus;

      if (isExpected) {
        passedCount++;
        console.log(`   ✅ [PASS] ${t.desc} -> Status: ${res.status}`);
      } else {
        failedCount++;
        console.log(`   ❌ [FAIL] ${t.desc} -> Got Status: ${res.status} (Expected ${t.expectedStatus})`);
      }
    }

    console.log("\n📋 4. Deep Testing Category Isolation for Maintenance vs Housekeeping...");
    
    // Check Maintenance user data
    const mntRes = await apiRequest("/api/maintenance?propertyId=1", sessions["test_maintenance"].cookie);
    const mntData = mntRes.body?.data || [];
    console.log(`   ℹ️  Maintenance User received ${mntData.length} tickets.`);
    const hasOnlyNonHsk = mntData.length > 0 && mntData.every(t => t.category !== "housekeeping");
    console.log(`   ${hasOnlyNonHsk ? "✅ [PASS]" : "❌ [FAIL]"} Category isolation: Maintenance user sees tickets and 0 housekeeping orders: ${hasOnlyNonHsk}`);

    // Check Housekeeping user data
    const hskRes = await apiRequest("/api/maintenance?propertyId=1", sessions["test_housekeeping"].cookie);
    const hskData = hskRes.body?.data || [];
    console.log(`   ℹ️  Housekeeping User received ${hskData.length} tickets.`);
    const hasOnlyHsk = hskData.length > 0 && hskData.every(t => t.category === "housekeeping");
    console.log(`   ${hasOnlyHsk ? "✅ [PASS]" : "❌ [FAIL]"} Category isolation: Housekeeping user sees ONLY housekeeping orders: ${hasOnlyHsk}`);

    console.log("\n==================================================");
    const finalTotal = tests.length + 2;
    const finalPassed = passedCount + (hasOnlyNonHsk ? 1 : 0) + (hasOnlyHsk ? 1 : 0);
    const finalFailed = failedCount + (hasOnlyNonHsk ? 0 : 1) + (hasOnlyHsk ? 0 : 1);
    console.log(`TOTAL TESTS: ${finalTotal}`);
    console.log(`PASSED: ${finalPassed}`);
    console.log(`FAILED: ${finalFailed}`);
    console.log(`SUCCESS RATE: ${Math.round((finalPassed / finalTotal) * 100)}%`);
    console.log("==================================================");

  } finally {
    await pool.end();
  }
}

run().catch(console.error);
