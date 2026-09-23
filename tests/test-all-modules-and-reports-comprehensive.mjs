import { createRequire } from "module";
const require = createRequire(import.meta.resolve("../lib/db/package.json"));
const pg = require("pg");

const API_URL = "http://localhost:4000";
const TEST_PASSWORD = "Password@123!";

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
    // non-json
  }

  return {
    status: res.status,
    ok: res.ok,
    body
  };
}

async function run() {
  console.log("================================================================================");
  console.log("   SUNRISE STAFF HOUSING — DEEP ALL-MODULES & ALL-REPORTS TEST HARNESS        ");
  console.log("================================================================================");

  console.log("\n🔑 1. Logging in as superadmin...");
  const sess = await login("test_superadmin", TEST_PASSWORD);
  console.log(`   ✅ Logged in as [${sess.user.username}], roles: [${sess.user.roles.join(",")}]`);
  const cookie = sess.cookie;

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assertTest(name, passed, detail = "") {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`   ✅ [PASS] ${name}${detail ? ` (${detail})` : ""}`);
    } else {
      failedTests++;
      console.error(`   ❌ [FAIL] ${name} ${detail}`);
    }
  }

  console.log("\n🏨 2. Testing ALL System Modules Endpoints (Tenant: Property 1 - Taal Housing)...");

  const moduleEndpoints = [
    { name: "Dashboard: Live Summary Stats", url: "/api/dashboard/stats?propertyId=1" },
    { name: "Dashboard: Housing Hierarchy Breakdown", url: "/api/dashboard/housing-breakdown?propertyId=1" },
    { name: "Dashboard: Tickets Dual-Track Overview", url: "/api/dashboard/tickets-overview?propertyId=1" },
    { name: "Dashboard: Occupancy by Building", url: "/api/dashboard/occupancy-by-building?propertyId=1" },
    { name: "Dashboard: Executive Analytics", url: "/api/dashboard/analytics?propertyId=1" },
    { name: "Dashboard: Recent Activity Feed", url: "/api/dashboard/recent-activity?propertyId=1" },
    { name: "Housing: Buildings", url: "/api/buildings?propertyId=1" },
    { name: "Housing: Floors", url: "/api/floors?propertyId=1" },
    { name: "Housing: Rooms List", url: "/api/rooms?propertyId=1&page=1&limit=10" },
    { name: "Housing: Room Inventory & Amenities", url: "/api/room-inventory?propertyId=1&page=1&limit=10" },
    { name: "Profiles: Staff Directory", url: "/api/profiles?propertyId=1&page=1&limit=10" },
    { name: "Accommodation: In-House Assignments", url: "/api/assignments?propertyId=1&page=1&limit=10" },
    { name: "Accommodation: History Archive", url: "/api/assignments/history?propertyId=1&page=1&limit=10" },
    { name: "Reservations Wizard List", url: "/api/reservations?propertyId=1&page=1&limit=10" },
    { name: "Guest Hosting: Active Stays", url: "/api/hostings?propertyId=1&page=1&limit=10" },
    { name: "Guest Hosting: Requests", url: "/api/hosting-requests?propertyId=1&page=1&limit=10" },
    { name: "Housekeeping: Cleaning Status Queue", url: "/api/rooms?propertyId=1&cleanliness=dirty" },
    { name: "Maintenance: Work Orders", url: "/api/maintenance?propertyId=1&page=1&limit=10" },
    { name: "Users & RBAC: System Users", url: "/api/users?page=1&limit=10" },
    { name: "Properties: Tenant Hotel List", url: "/api/properties" },
    { name: "Settings: Hotel Configuration", url: "/api/settings?propertyId=1" },
    { name: "Settings: Lookup Values", url: "/api/lookup-values?propertyId=1" },
    { name: "Settings: Door Lock Encoders", url: "/api/encoder/status?propertyId=1" },
    { name: "Activity Logs: Audit Trail", url: "/api/activity-logs?propertyId=1&page=1&limit=10" },
    { name: "Gate Pass Scanner: Logs", url: "/api/gate/logs?propertyId=1&page=1&limit=10" },
    { name: "Gate Pass Scanner: Stats", url: "/api/gate/stats?propertyId=1" },
    { name: "Workers: Staff & Technicians", url: "/api/workers?propertyId=1" },
    { name: "HR Sync: Config & Status", url: "/api/hr-sync/config?propertyId=1" }
  ];

  for (const mod of moduleEndpoints) {
    const res = await apiRequest(mod.url, cookie);
    assertTest(mod.name, res.status === 200, `HTTP ${res.status}`);
  }

  console.log("\n📊 3. Testing ALL 24 Reports Tabs + Custom Config Builder...");

  const reportTabs = [
    { id: "manager_flash", name: "التقرير الصباحي الشامل (Morning Operations Report)" },
    { id: "arrivals_manifest", name: "الحجوزات والمتوقع وصولهم (Reservations & Arrivals)" },
    { id: "departures_manifest", name: "كشف المغادرات والتصفيات (Due Out & Departures)" },
    { id: "housekeeping_sheet", name: "كشف مهام ونظافة الغرف (Housekeeping & Cleanliness)" },
    { id: "room_discrepancy", name: "تدقيق ومطابقة الغرف (Room Discrepancy & Audit)" },
    { id: "occupancy_forecast", name: "توقعات الإشغال المستقبلية (Occupancy Forecast)" },
    { id: "analytics", name: "تحليلات عامة (Analytics)" },
    { id: "assignments", name: "المقيمين والتسكين (In-House Occupants & Rooms)" },
    { id: "vacant_rooms", name: "مصفوفة السعة والأسرة الشاغرة (Vacant Beds & Capacity)" },
    { id: "housing", name: "سجل وحالة كافة الغرف (Complete Room Inventory)" },
    { id: "daily_movement", name: "الحركة اليومية (Daily Movement)" },
    { id: "department_occupancy", name: "إشغال الأقسام (Department Occupancy)" },
    { id: "gate_logs", name: "سجل البوابة والأمن (Gate Security Logs)" },
    { id: "police_report", name: "كشف شرطة ووزارة السياحة (Tourism Police Manifest)" },
    { id: "equipment_inventory", name: "جرد المحتويات والمعدات (Amenities Inventory)" },
    { id: "profiles", name: "دليل البروفايلات (Profiles Directory)" },
    { id: "expiring_contracts", name: "انتهاء العقود (Contract Expirations)" },
    { id: "hostings", name: "الاستضافات والزوار (Guest Hostings)" },
    { id: "maintenance", name: "طلبات الصيانة (Maintenance Work Orders)" },
    { id: "service_ratings", name: "تقييمات جودة الصيانة والنظافة (Service Quality)" },
    { id: "housing_map", name: "خريطة وتفصيل السكن والمباني (Housing Map)" },
    { id: "water_distribution", name: "كشف صرف مياه الشرب الشهري (Water Distribution)" },
    { id: "vacations", name: "سجل وأرشيف إجازات الموظفين (Staff Vacations)" },
    { id: "policy_exceptions", name: "تقرير استثناءات ومخالفات السياسة (Policy Exceptions)" }
  ];

  for (const rep of reportTabs) {
    if (rep.id === "service_ratings") {
      const res = await apiRequest(`/api/reports/service-ratings?propertyId=1`, cookie);
      assertTest(`Report [${rep.id}]: ${rep.name}`, res.status === 200, `HTTP ${res.status}`);
    } else if (rep.id === "vacations") {
      const res = await apiRequest(`/api/reports/vacations?propertyId=1`, cookie);
      assertTest(`Report [${rep.id}]: ${rep.name}`, res.status === 200, `HTTP ${res.status}`);
    } else {
      const res = await apiRequest(`/api/reports?tab=${rep.id}&propertyId=1&page=1&limit=10`, cookie);
      assertTest(`Report [${rep.id}]: ${rep.name}`, res.status === 200, `HTTP ${res.status}`);
    }
  }

  // Test Custom Configuration Report endpoints
  console.log("\n🛠️  4. Testing Custom Configuration Report APIs...");
  const customTemplatesRes = await apiRequest(`/api/reports/custom/templates?propertyId=1`, cookie);
  assertTest("Custom Report Templates Listing", customTemplatesRes.status === 200, `HTTP ${customTemplatesRes.status}`);

  const customQueryRes = await apiRequest(`/api/reports/custom/query?propertyId=1`, cookie, {
    method: "POST",
    body: JSON.stringify({
      entity: "profiles",
      columns: ["profileId", "firstName", "lastName", "department", "jobTitle"],
      filters: [],
      page: 1,
      limit: 10
    })
  });
  assertTest("Custom Report Dynamic Query Engine (Profiles)", customQueryRes.status === 200, `HTTP ${customQueryRes.status}`);

  const customQueryRoomsRes = await apiRequest(`/api/reports/custom/query?propertyId=1`, cookie, {
    method: "POST",
    body: JSON.stringify({
      entity: "rooms",
      columns: ["roomNumber", "roomType", "status", "capacity"],
      filters: [],
      page: 1,
      limit: 10
    })
  });
  assertTest("Custom Report Dynamic Query Engine (Rooms)", customQueryRoomsRes.status === 200, `HTTP ${customQueryRoomsRes.status}`);

  const customQueryAssignmentsRes = await apiRequest(`/api/reports/custom/query?propertyId=1`, cookie, {
    method: "POST",
    body: JSON.stringify({
      entity: "assignments",
      columns: ["id", "bedNumber", "status", "checkInDate"],
      filters: [],
      page: 1,
      limit: 10
    })
  });
  assertTest("Custom Report Dynamic Query Engine (Assignments)", customQueryAssignmentsRes.status === 200, `HTTP ${customQueryAssignmentsRes.status}`);

  const customQueryMaintenanceRes = await apiRequest(`/api/reports/custom/query?propertyId=1`, cookie, {
    method: "POST",
    body: JSON.stringify({
      entity: "maintenance",
      columns: ["id", "problemType", "status", "priority"],
      filters: [],
      page: 1,
      limit: 10
    })
  });
  assertTest("Custom Report Dynamic Query Engine (Maintenance)", customQueryMaintenanceRes.status === 200, `HTTP ${customQueryMaintenanceRes.status}`);

  console.log("\n================================================================================");
  console.log(` TOTAL VERIFICATIONS : ${totalTests}`);
  console.log(` PASSED              : ${passedTests}`);
  console.log(` FAILED              : ${failedTests}`);
  console.log(` OVERALL PASS RATE   : ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
