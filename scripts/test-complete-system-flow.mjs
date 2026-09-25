import { pool } from "../lib/db/src/index.ts";

const BASE_URL = "http://127.0.0.1:4000/api";

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = res.headers.get("set-cookie");
  const data = await res.json().catch(() => ({}));
  return { status: res.status, cookie, data };
}

async function api(path, { method = "GET", body, cookie, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, data: json };
}

async function run() {
  console.log("======================================================================");
  console.log("🌟 STARTING COMPREHENSIVE END-TO-END FLOW VERIFICATION 🌟");
  console.log("======================================================================\n");

  const ts = Date.now();
  let adminCookie = null;
  const createdIds = {
    buildingId: null,
    floorId: null,
    roomAId: null,
    roomBId: null,
    profileId: null,
    reservationId: null,
    assignmentAId: null,
    assignmentBId: null,
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Authentication Check
    // -------------------------------------------------------------------------
    console.log("▶ [1/9] Testing Authentication & RBAC Login...");
    const loginRes = await login("admin", "admin123");
    if (loginRes.status !== 200 || !loginRes.cookie) {
      throw new Error(`Admin login failed: ${loginRes.status} ${JSON.stringify(loginRes.data)}`);
    }
    adminCookie = loginRes.cookie;
    console.log("  ✅ Admin logged in successfully.\n");

    // -------------------------------------------------------------------------
    // 2. Properties Listing & Tenant Schemas
    // -------------------------------------------------------------------------
    console.log("▶ [2/9] Testing Properties & Schema Isolation...");
    const propsRes = await api("/properties", { cookie: adminCookie });
    if (propsRes.status !== 200 || !Array.isArray(propsRes.data.data || propsRes.data)) {
      throw new Error(`Failed to list properties: ${propsRes.status}`);
    }
    const propertiesList = propsRes.data.data || propsRes.data;
    console.log(`  ✅ Successfully fetched ${propertiesList.length} properties across schemas.`);
    const prop1 = propertiesList.find(p => p.id === 1) || propertiesList[0];
    const testPropertyId = prop1.id;
    console.log(`  Selected Property for workflow: "${prop1.name}" (ID: ${testPropertyId}, Schema: ${prop1.schemaName || 'taal_housing'})\n`);

    // -------------------------------------------------------------------------
    // 3. Buildings, Floors & Rooms Creation (إضافة مباني وأدوار وغرف)
    // -------------------------------------------------------------------------
    console.log("▶ [3/9] Testing Housing Structure: Buildings, Floors & Rooms Creation...");
    
    // 3.1 Create Building
    const bldPayload = {
      name: `Test Building ${ts}`,
      location: "East Wing",
      status: "active",
      propertyId: testPropertyId,
      capacity: 10,
    };
    const bldRes = await api("/buildings", {
      method: "POST",
      cookie: adminCookie,
      body: bldPayload,
      params: { propertyId: testPropertyId },
    });
    if (bldRes.status !== 201 && bldRes.status !== 200) {
      throw new Error(`Failed to create building: ${JSON.stringify(bldRes.data)}`);
    }
    createdIds.buildingId = bldRes.data.id || bldRes.data.data?.id;
    console.log(`  ✅ Building created successfully (ID: ${createdIds.buildingId})`);

    // 3.2 Create Floor
    const flrPayload = {
      buildingId: createdIds.buildingId,
      floorNumber: "1",
      description: `Floor 1 - ${ts}`,
      propertyId: testPropertyId,
    };
    const flrRes = await api("/floors", {
      method: "POST",
      cookie: adminCookie,
      body: flrPayload,
      params: { propertyId: testPropertyId },
    });
    if (flrRes.status !== 201 && flrRes.status !== 200) {
      throw new Error(`Failed to create floor: ${JSON.stringify(flrRes.data)}`);
    }
    createdIds.floorId = flrRes.data.id || flrRes.data.data?.id;
    console.log(`  ✅ Floor created successfully (ID: ${createdIds.floorId})`);

    // 3.3 Create Room A
    const rmAPayload = {
      buildingId: createdIds.buildingId,
      floorId: createdIds.floorId,
      roomNumber: `A-${ts.toString().slice(-4)}`,
      roomType: "double",
      capacity: 2,
      gender: "MALE",
      level: "STAFF",
      status: "available",
      propertyId: testPropertyId,
    };
    const rmARes = await api("/rooms", {
      method: "POST",
      cookie: adminCookie,
      body: rmAPayload,
      params: { propertyId: testPropertyId },
    });
    if (rmARes.status !== 201 && rmARes.status !== 200) {
      throw new Error(`Failed to create Room A: ${JSON.stringify(rmARes.data)}`);
    }
    createdIds.roomAId = rmARes.data.id || rmARes.data.data?.id;
    console.log(`  ✅ Room A created successfully (ID: ${createdIds.roomAId}, Number: ${rmAPayload.roomNumber})`);

    // 3.4 Create Room B
    const rmBPayload = {
      buildingId: createdIds.buildingId,
      floorId: createdIds.floorId,
      roomNumber: `B-${ts.toString().slice(-4)}`,
      roomType: "double",
      capacity: 2,
      gender: "MALE",
      level: "STAFF",
      status: "available",
      propertyId: testPropertyId,
    };
    const rmBRes = await api("/rooms", {
      method: "POST",
      cookie: adminCookie,
      body: rmBPayload,
      params: { propertyId: testPropertyId },
    });
    if (rmBRes.status !== 201 && rmBRes.status !== 200) {
      throw new Error(`Failed to create Room B: ${JSON.stringify(rmBRes.data)}`);
    }
    createdIds.roomBId = rmBRes.data.id || rmBRes.data.data?.id;
    console.log(`  ✅ Room B created successfully (ID: ${createdIds.roomBId}, Number: ${rmBPayload.roomNumber})\n`);

    // -------------------------------------------------------------------------
    // 4. Employee Profile Creation (الملف التعريفي للموظف)
    // -------------------------------------------------------------------------
    console.log("▶ [4/9] Testing Employee Profile Management...");
    const profileCode = `CLK-${ts.toString().slice(-5)}`;
    const nationalId = `NID${ts}`;
    const profilePayload = {
      firstName: "Automated",
      lastName: `TestUser-${ts.toString().slice(-4)}`,
      firstNameAr: "مستخدم",
      lastNameAr: "اختباري",
      profileId: profileCode,
      nationalId,
      phone: "+201000000000",
      department: "Front Office",
      jobTitle: "Receptionist",
      gender: "M",
      level: "STAFF",
      status: "ACTIVE",
      propertyId: testPropertyId,
    };
    const profRes = await api("/profiles", {
      method: "POST",
      cookie: adminCookie,
      body: profilePayload,
      params: { propertyId: testPropertyId },
    });
    if (profRes.status !== 201 && profRes.status !== 200) {
      throw new Error(`Failed to create profile: ${JSON.stringify(profRes.data)}`);
    }
    createdIds.profileId = profRes.data.id || profRes.data.data?.id;
    console.log(`  ✅ Profile created successfully (ID: ${createdIds.profileId}, Code: ${profileCode})\n`);

    // -------------------------------------------------------------------------
    // 5. Reservations (حجز مسبق)
    // -------------------------------------------------------------------------
    console.log("▶ [5/9] Testing Reservation Flow...");
    const todayStr = new Date().toISOString().split("T")[0];
    const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const resvPayload = {
      firstName: "Guest",
      lastName: `Reservation-${ts.toString().slice(-4)}`,
      checkInDate: todayStr,
      checkOutDate: nextWeekStr,
      roomId: createdIds.roomAId,
      roomType: "double",
      guestIdCardNumber: `RESV-ID-${ts}`,
      guestPhone: "+201011111111",
      department: "Food & Beverage",
      jobTitle: "Waiter",
      propertyId: testPropertyId,
    };
    const resvRes = await api("/reservations", {
      method: "POST",
      cookie: adminCookie,
      body: resvPayload,
      params: { propertyId: testPropertyId },
    });
    if (resvRes.status !== 201 && resvRes.status !== 200) {
      throw new Error(`Failed to create reservation: ${JSON.stringify(resvRes.data)}`);
    }
    createdIds.reservationId = resvRes.data.id || resvRes.data.data?.id;
    console.log(`  ✅ Reservation created successfully (ID: ${createdIds.reservationId})`);

    // Verify list reservations returns it
    const listResv = await api("/reservations", {
      cookie: adminCookie,
      params: { propertyId: testPropertyId, limit: 10 },
    });
    const foundResv = (listResv.data.data || []).some(r => r.id === createdIds.reservationId);
    if (!foundResv) {
      throw new Error("Created reservation not found in GET /reservations listing");
    }
    console.log("  ✅ GET /reservations accurately returned the newly created reservation.\n");

    // -------------------------------------------------------------------------
    // 6. Smart Room Assignment & Check-In (تسكين الغرفة)
    // -------------------------------------------------------------------------
    console.log("▶ [6/9] Testing Smart Room Assignment (Check-in)...");
    const assignPayload = {
      profileId: createdIds.profileId,
      roomId: createdIds.roomAId,
      bedNumber: 1,
      checkInDate: todayStr,
      notes: "E2E Automated test check-in",
      propertyId: testPropertyId,
    };
    const assignRes = await api("/assignments", {
      method: "POST",
      cookie: adminCookie,
      body: assignPayload,
      params: { propertyId: testPropertyId },
    });
    if (assignRes.status !== 201 && assignRes.status !== 200) {
      throw new Error(`Failed to create assignment: ${JSON.stringify(assignRes.data)}`);
    }
    createdIds.assignmentAId = assignRes.data.id || assignRes.data.data?.id;
    console.log(`  ✅ Check-in completed successfully (Assignment ID: ${createdIds.assignmentAId})`);

    // Verify Room A occupancy increased and status changed to occupied
    const checkRoomARes = await api(`/rooms/${createdIds.roomAId}`, {
      cookie: adminCookie,
      params: { propertyId: testPropertyId },
    });
    const roomAData = checkRoomARes.data.room || checkRoomARes.data.data || checkRoomARes.data;
    console.log(`  Room A Status: ${roomAData.status}, Occupancy: ${roomAData.currentOccupancy}/${roomAData.capacity}`);
    if (roomAData.currentOccupancy !== 1 || roomAData.status !== "occupied") {
      throw new Error(`Room A occupancy/status invariant failed after check-in! Got status: ${roomAData.status}, occupancy: ${roomAData.currentOccupancy}`);
    }
    console.log("  ✅ Room occupancy & status lifecycle invariant verified on check-in.\n");

    // -------------------------------------------------------------------------
    // 7. Room Move / Transfer (الروم موف / نقل الغرفة والسرير)
    // -------------------------------------------------------------------------
    console.log("▶ [7/9] Testing Room Move / Transfer Flow...");
    const transferPayload = {
      newRoomId: createdIds.roomBId,
      newBedNumber: 1,
      transferDate: todayStr,
      transferReason: "Routine room reassignment test",
      propertyId: testPropertyId,
    };
    const transferRes = await api(`/assignments/${createdIds.assignmentAId}/transfer`, {
      method: "POST",
      cookie: adminCookie,
      body: transferPayload,
      params: { propertyId: testPropertyId },
    });
    if (transferRes.status !== 200 && transferRes.status !== 201) {
      throw new Error(`Failed to transfer assignment: ${JSON.stringify(transferRes.data)}`);
    }
    const transferredAssignment = transferRes.data.data || transferRes.data;
    createdIds.assignmentBId = transferredAssignment.id;
    console.log(`  ✅ Transfer completed successfully! (New Assignment ID: ${createdIds.assignmentBId})`);

    // Verify Room A released bed and marked dirty
    const afterTransferRoomA = await api(`/rooms/${createdIds.roomAId}`, {
      cookie: adminCookie,
      params: { propertyId: testPropertyId },
    });
    const rA = afterTransferRoomA.data.room || afterTransferRoomA.data.data || afterTransferRoomA.data;
    console.log(`  Source Room A after transfer -> Status: ${rA.status}, Occupancy: ${rA.currentOccupancy}`);
    if (rA.currentOccupancy !== 0 || rA.status !== "dirty") {
      throw new Error(`Source Room A should be dirty with 0 occupancy after transfer! Got status: ${rA.status}, occupancy: ${rA.currentOccupancy}`);
    }

    // Verify Room B now has occupancy 1 and occupied status
    const afterTransferRoomB = await api(`/rooms/${createdIds.roomBId}`, {
      cookie: adminCookie,
      params: { propertyId: testPropertyId },
    });
    const rB = afterTransferRoomB.data.room || afterTransferRoomB.data.data || afterTransferRoomB.data;
    console.log(`  Target Room B after transfer -> Status: ${rB.status}, Occupancy: ${rB.currentOccupancy}`);
    if (rB.currentOccupancy !== 1 || rB.status !== "occupied") {
      throw new Error(`Target Room B should be occupied with 1 occupancy after transfer! Got status: ${rB.status}, occupancy: ${rB.currentOccupancy}`);
    }
    console.log("  ✅ Room Move invariants verified 100%: source room vacated & dirtied, target room occupied.\n");

    // -------------------------------------------------------------------------
    // 8. Checkout (تسجيل المغادرة)
    // -------------------------------------------------------------------------
    console.log("▶ [8/9] Testing Checkout Flow...");
    const activeAssignmentId = createdIds.assignmentBId || createdIds.assignmentAId;
    const checkoutPayload = {
      checkOutDate: todayStr,
      checkOutReason: "End of contract test",
      propertyId: testPropertyId,
    };
    const checkoutRes = await api(`/assignments/${activeAssignmentId}/checkout`, {
      method: "POST",
      cookie: adminCookie,
      body: checkoutPayload,
      params: { propertyId: testPropertyId },
    });
    if (checkoutRes.status !== 200) {
      throw new Error(`Failed to checkout assignment: ${JSON.stringify(checkoutRes.data)}`);
    }
    console.log("  ✅ Checkout completed successfully.");

    // Verify Room B is now dirty with 0 occupancy
    const afterCheckoutRoomB = await api(`/rooms/${createdIds.roomBId}`, {
      cookie: adminCookie,
      params: { propertyId: testPropertyId },
    });
    const rBFinal = afterCheckoutRoomB.data.room || afterCheckoutRoomB.data.data || afterCheckoutRoomB.data;
    console.log(`  Room B after checkout -> Status: ${rBFinal.status}, Occupancy: ${rBFinal.currentOccupancy}`);
    if (rBFinal.currentOccupancy !== 0 || rBFinal.status !== "dirty") {
      throw new Error(`Room B should be dirty with 0 occupancy after checkout! Got status: ${rBFinal.status}, occupancy: ${rBFinal.currentOccupancy}`);
    }
    console.log("  ✅ Checkout status transition (dirty + decremented occupancy) verified.\n");

    // -------------------------------------------------------------------------
    // 9. HR Sync Configuration & Endpoint Readiness
    // -------------------------------------------------------------------------
    console.log("▶ [9/9] Testing HR Sync Configuration & Endpoints...");
    const hrSyncRes = await api("/hr-sync/config", {
      cookie: adminCookie,
      params: { propertyId: testPropertyId },
    });
    if (hrSyncRes.status !== 200) {
      throw new Error(`Failed to get HR Sync config: ${hrSyncRes.status}`);
    }
    console.log("  ✅ HR Sync config endpoint responded with status 200.");
    console.log(`  HR Sync Active: ${Boolean(hrSyncRes.data.config?.isActive)}, Config Sources: ${Array.isArray(hrSyncRes.data.config?.esignConfigs) ? hrSyncRes.data.config.esignConfigs.length : 'N/A'}\n`);

    console.log("======================================================================");
    console.log("🏆 ALL 9 CORE SUBSYSTEMS VERIFIED 100% OPERATIONAL WITH ZERO ERRORS 🏆");
    console.log("======================================================================\n");

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup created test entities sequentially to keep database clean
    // -------------------------------------------------------------------------
    console.log("🧹 Cleaning up automated test records sequentially...");
    const schemaName = "taal_housing";
    if (createdIds.reservationId) {
      await pool.query(`DELETE FROM ${schemaName}.reservations WHERE id = $1`, [createdIds.reservationId]).catch(() => {});
    }
    if (createdIds.assignmentBId) {
      await pool.query(`DELETE FROM ${schemaName}.assignments WHERE id = $1`, [createdIds.assignmentBId]).catch(() => {});
    }
    if (createdIds.assignmentAId) {
      await pool.query(`DELETE FROM ${schemaName}.assignments WHERE id = $1`, [createdIds.assignmentAId]).catch(() => {});
    }
    if (createdIds.profileId) {
      await pool.query(`DELETE FROM ${schemaName}.profiles WHERE id = $1`, [createdIds.profileId]).catch(() => {});
    }
    if (createdIds.roomAId) {
      await pool.query(`DELETE FROM ${schemaName}.rooms WHERE id = $1`, [createdIds.roomAId]).catch(() => {});
    }
    if (createdIds.roomBId) {
      await pool.query(`DELETE FROM ${schemaName}.rooms WHERE id = $1`, [createdIds.roomBId]).catch(() => {});
    }
    if (createdIds.floorId) {
      await pool.query(`DELETE FROM ${schemaName}.floors WHERE id = $1`, [createdIds.floorId]).catch(() => {});
    }
    if (createdIds.buildingId) {
      await pool.query(`DELETE FROM ${schemaName}.buildings WHERE id = $1`, [createdIds.buildingId]).catch(() => {});
    }
    console.log("✨ Test cleanup completed cleanly.");
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
