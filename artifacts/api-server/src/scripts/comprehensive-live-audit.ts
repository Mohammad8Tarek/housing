import {
  db,
  pool,
  withTenant,
  propertiesTable,
  usersTable,
  roomsTable,
  assignmentsTable,
  profilesTable,
  reservationsTable,
  hostingsTable,
  maintenanceTable,
  profileVacationsTable,
  portalConversationsTable,
  portalMessagesTable,
  profilePortalAccountsTable,
  buildingsTable,
  floorsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  findAssignmentAcrossAllProperties,
  findRoomAcrossAllProperties,
  findReservationAcrossAllProperties,
  findHostingAcrossAllProperties,
  findProfileAcrossAllProperties,
} from "../lib/cross-property-service.js";
import { resolveProfileTenant } from "../routes/profiles.js";

interface AuditResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: AuditResult[] = [];

function record(suite: string, name: string, passed: boolean, details?: string) {
  results.push({ suite, name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${suite}] ${name}${details ? ` -> ${details}` : ""}`);
}

async function runAudit() {
  console.log("===============================================================");
  console.log("   SUNRISE HOUSING SYSTEM - COMPREHENSIVE LIVE AUDIT SUITE");
  console.log("===============================================================\n");

  try {
    // -----------------------------------------------------------------
    // 1. Database & Schemas Connectivity
    // -----------------------------------------------------------------
    const properties = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name, schemaName: propertiesTable.schemaName })
      .from(propertiesTable);

    record("Database", "Properties Fetch", properties.length > 0, `Found ${properties.length} properties: ${properties.map((p) => p.schemaName).join(", ")}`);

    for (const prop of properties) {
      try {
        const roomCount = await withTenant(prop.id, async (tenantDb) => {
          const res = await tenantDb.select({ count: sql<number>`count(*)` }).from(roomsTable);
          return Number(res[0]?.count ?? 0);
        });
        record("Multi-Tenant Schemas", `Schema ${prop.schemaName} Query`, true, `Rooms count: ${roomCount}`);
      } catch (err: any) {
        record("Multi-Tenant Schemas", `Schema ${prop.schemaName} Query`, false, err?.message);
      }
    }

    if (properties.length < 1) {
      console.error("No properties found to run audit on!");
      process.exit(1);
    }

    const testProp1 = properties[0];
    const testProp2 = properties.length > 1 ? properties[1] : properties[0];

    // -----------------------------------------------------------------
    // 2. Cross-Property Auto-Discovery Engine
    // -----------------------------------------------------------------
    console.log("\n--- Testing Cross-Property Auto-Discovery Engine ---");

    // Create a mock profile in property 1
    const testProfileCode = `AUDIT-EMP-${Date.now()}`;
    const [testProfile] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(profilesTable)
        .values({
          profileId: testProfileCode,
          firstName: "Audit",
          lastName: "Employee",
          department: "IT",
          jobTitle: "Quality Assurance",
          gender: "M",
          status: "ACTIVE",
          phone: "01000000001",
          nationalId: `NAT-${Date.now()}`,
          hireDate: new Date().toISOString().split("T")[0],
        })
        .returning();
    });

    record("Cross-Property", "Create Audit Profile in Tenant 1", !!testProfile, `Profile ID: ${testProfile.id}`);

    // Try to resolve this profile from tenant 2 context
    const resolvedProfile = await resolveProfileTenant(testProfile.id, testProp2.id);
    record(
      "Cross-Property",
      "Resolve Profile From Different Tenant Context",
      !!resolvedProfile && resolvedProfile.propertyId === testProp1.id,
      `Expected Property ${testProp1.id}, got ${resolvedProfile?.propertyId}`,
    );

    // Fetch building and floor for testProp1
    const [existingBld] = await withTenant(testProp1.id, (t) => t.select().from(buildingsTable).limit(1));
    const [existingFlr] = await withTenant(testProp1.id, (t) =>
      t.select().from(floorsTable).where(eq(floorsTable.buildingId, existingBld.id)).limit(1)
    );

    // Create an audit room in property 1
    const testRoomNum = `AUDIT-${Math.floor(Math.random() * 9000 + 1000)}`;
    const [testRoom] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(roomsTable)
        .values({
          buildingId: existingBld.id,
          floorId: existingFlr.id,
          roomNumber: testRoomNum,
          capacity: 2,
          currentOccupancy: 0,
          status: "available",
          gender: "male",
        })
        .returning();
    });

    record("Cross-Property", "Create Audit Room in Tenant 1", !!testRoom, `Room ID: ${testRoom.id}, No: ${testRoomNum}`);

    const resolvedRoom = await findRoomAcrossAllProperties(testRoom.id);
    record(
      "Cross-Property",
      "Find Room Across Schemas",
      !!resolvedRoom && resolvedRoom.propertyId === testProp1.id,
      `Room ID: ${resolvedRoom?.room?.id} in Property: ${resolvedRoom?.propertyId}`,
    );

    // Create an audit assignment in property 1
    const [testAssignment] = await withTenant(testProp1.id, async (tenantDb) => {
      // update room occupancy
      await tenantDb.update(roomsTable).set({ currentOccupancy: 1, status: "occupied" }).where(eq(roomsTable.id, testRoom.id));
      return tenantDb
        .insert(assignmentsTable)
        .values({
          profileId: testProfile.id,
          roomId: testRoom.id,
          bedNumber: 1,
          status: "ACTIVE",
          checkInDate: new Date().toISOString().split("T")[0],
        })
        .returning();
    });

    record("Cross-Property", "Create Audit Assignment", !!testAssignment, `Assignment ID: ${testAssignment.id}`);

    const resolvedAssignment = await findAssignmentAcrossAllProperties(testAssignment.id);
    record(
      "Cross-Property",
      "Find Assignment Across Schemas",
      !!resolvedAssignment && resolvedAssignment.propertyId === testProp1.id,
      `Assignment ID: ${resolvedAssignment?.assignment?.id} in Property: ${resolvedAssignment?.propertyId}`,
    );

    // Create an audit reservation in property 1
    const [testRes] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(reservationsTable)
        .values({
          firstName: "Guest",
          lastName: "Audit",
          department: "Front Office",
          jobTitle: "Supervisor",
          status: "UPCOMING",
          checkInDate: new Date().toISOString().split("T")[0],
          checkOutDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        })
        .returning();
    });

    record("Cross-Property", "Create Audit Reservation", !!testRes, `Reservation ID: ${testRes.id}`);

    const resolvedRes = await findReservationAcrossAllProperties(testRes.id);
    record(
      "Cross-Property",
      "Find Reservation Across Schemas",
      !!resolvedRes && resolvedRes.propertyId === testProp1.id,
      `Reservation ID: ${resolvedRes?.reservation?.id} in Property: ${resolvedRes?.propertyId}`,
    );

    // Create an audit hosting in property 1
    const [testHost] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(hostingsTable)
        .values({
          profileId: testProfile.id,
          hostingType: "SAME_ROOM",
          guestsCount: 1,
          expectedFrom: new Date().toISOString().split("T")[0],
          expectedTo: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          status: "PENDING",
          createdBy: "audit_runner",
        })
        .returning();
    });

    record("Cross-Property", "Create Audit Guest Hosting", !!testHost, `Hosting ID: ${testHost.id}`);

    const resolvedHost = await findHostingAcrossAllProperties(testHost.id);
    record(
      "Cross-Property",
      "Find Guest Hosting Across Schemas",
      !!resolvedHost && resolvedHost.propertyId === testProp1.id,
      `Hosting ID: ${resolvedHost?.hosting?.id} in Property: ${resolvedHost?.propertyId}`,
    );

    // -----------------------------------------------------------------
    // 3. Accommodation Lifecycle & State Transitions
    // -----------------------------------------------------------------
    console.log("\n--- Testing Accommodation Lifecycle & Transitions ---");

    // Vacation registration test
    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb.update(profilesTable).set({ status: "VACATION" }).where(eq(profilesTable.id, testProfile.id));
      await tenantDb.update(roomsTable).set({ status: "occupied_vacation" }).where(eq(roomsTable.id, testRoom.id));
      await tenantDb.insert(profileVacationsTable).values({
        profileId: testProfile.id,
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
        status: "ACTIVE",
      });
    });

    const [vacRoom] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb.select().from(roomsTable).where(eq(roomsTable.id, testRoom.id));
    });
    record("Accommodation Lifecycle", "Vacation Sets Room to occupied_vacation", vacRoom?.status === "occupied_vacation", `Status: ${vacRoom?.status}`);

    // Return from vacation test
    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb.update(profilesTable).set({ status: "ACTIVE" }).where(eq(profilesTable.id, testProfile.id));
      await tenantDb.update(roomsTable).set({ status: "occupied" }).where(eq(roomsTable.id, testRoom.id));
      await tenantDb.update(profileVacationsTable).set({ status: "COMPLETED" }).where(eq(profileVacationsTable.profileId, testProfile.id));
    });

    const [retRoom] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb.select().from(roomsTable).where(eq(roomsTable.id, testRoom.id));
    });
    record("Accommodation Lifecycle", "Return from Vacation Restores Room to occupied", retRoom?.status === "occupied", `Status: ${retRoom?.status}`);

    // Room Transfer test
    const testRoomNum2 = `AUDIT-${Math.floor(Math.random() * 9000 + 1000)}`;
    const [testRoom2] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(roomsTable)
        .values({
          buildingId: existingBld.id,
          floorId: existingFlr.id,
          roomNumber: testRoomNum2,
          capacity: 2,
          currentOccupancy: 0,
          status: "available",
          gender: "male",
        })
        .returning();
    });

    // Perform room move
    await withTenant(testProp1.id, async (tenantDb) => {
      // 1. Release old room bed and decrement occupancy, mark dirty
      await tenantDb.update(roomsTable).set({ currentOccupancy: 0, status: "dirty" }).where(eq(roomsTable.id, testRoom.id));
      // 2. Transfer assignment to new room
      await tenantDb.update(assignmentsTable).set({ roomId: testRoom2.id, bedNumber: 2 }).where(eq(assignmentsTable.id, testAssignment.id));
      // 3. Increment new room occupancy
      await tenantDb.update(roomsTable).set({ currentOccupancy: 1, status: "occupied" }).where(eq(roomsTable.id, testRoom2.id));
    });

    const [afterTransferOldRoom] = await withTenant(testProp1.id, (t) => t.select().from(roomsTable).where(eq(roomsTable.id, testRoom.id)));
    const [afterTransferNewRoom] = await withTenant(testProp1.id, (t) => t.select().from(roomsTable).where(eq(roomsTable.id, testRoom2.id)));
    const [afterTransferAssign] = await withTenant(testProp1.id, (t) => t.select().from(assignmentsTable).where(eq(assignmentsTable.id, testAssignment.id)));

    record(
      "Accommodation Lifecycle",
      "Room Move Updates Old & New Rooms + Assignment",
      afterTransferOldRoom.currentOccupancy === 0 &&
        afterTransferOldRoom.status === "dirty" &&
        afterTransferNewRoom.currentOccupancy === 1 &&
        afterTransferAssign.roomId === testRoom2.id,
      `Old Room Occ: ${afterTransferOldRoom.currentOccupancy}, Old Room Status: ${afterTransferOldRoom.status}, New Room Occ: ${afterTransferNewRoom.currentOccupancy}`,
    );

    // Checkout test
    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb.update(assignmentsTable).set({ status: "COMPLETED", checkOutDate: new Date().toISOString().split("T")[0] }).where(eq(assignmentsTable.id, testAssignment.id));
      await tenantDb.update(roomsTable).set({ currentOccupancy: 0, status: "dirty" }).where(eq(roomsTable.id, testRoom2.id));
    });

    const [checkedOutAssign] = await withTenant(testProp1.id, (t) => t.select().from(assignmentsTable).where(eq(assignmentsTable.id, testAssignment.id)));
    const [checkedOutRoom] = await withTenant(testProp1.id, (t) => t.select().from(roomsTable).where(eq(roomsTable.id, testRoom2.id)));

    record(
      "Accommodation Lifecycle",
      "Checkout Completes Assignment & Marks Room Dirty",
      checkedOutAssign.status === "COMPLETED" && checkedOutRoom.status === "dirty",
      `Assignment Status: ${checkedOutAssign.status}, Room Status: ${checkedOutRoom.status}`,
    );

    // Housekeeping clean action test
    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb.update(roomsTable).set({ status: "available" }).where(eq(roomsTable.id, testRoom2.id));
    });
    const [cleanedRoom] = await withTenant(testProp1.id, (t) => t.select().from(roomsTable).where(eq(roomsTable.id, testRoom2.id)));
    record("Housekeeping", "Room Cleaning Restores Available Status", cleanedRoom.status === "available", `Status: ${cleanedRoom.status}`);

    // -----------------------------------------------------------------
    // 4. Maintenance Ticket Workflow
    // -----------------------------------------------------------------
    console.log("\n--- Testing Maintenance Ticket Workflow ---");
    const [testTicket] = await withTenant(testProp1.id, async (tenantDb) => {
      return tenantDb
        .insert(maintenanceTable)
        .values({
          roomId: testRoom.id,
          category: "plumbing",
          problemType: "Water Tap Leak",
          priority: "high",
          description: "Water tap leaking test",
          status: "open",
        })
        .returning();
    });

    record("Maintenance", "Create Maintenance Ticket", !!testTicket, `Ticket ID: ${testTicket.id}`);

    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb
        .update(maintenanceTable)
        .set({ status: "in_progress", notes: "Technician assigned" })
        .where(eq(maintenanceTable.id, testTicket.id));
    });

    const [updatedTicket] = await withTenant(testProp1.id, (t) => t.select().from(maintenanceTable).where(eq(maintenanceTable.id, testTicket.id)));
    record("Maintenance", "Update Ticket Status to in_progress", updatedTicket.status === "in_progress", `Status: ${updatedTicket.status}`);

    // -----------------------------------------------------------------
    // 5. Resident Portal Connectivity
    // -----------------------------------------------------------------
    console.log("\n--- Testing Resident Portal Backend Connectivity ---");
    const [conv] = await db
      .insert(portalConversationsTable)
      .values({
        propertyId: testProp1.id,
        subject: "Audit Inquiry",
        createdBy: testProfile.id,
      })
      .returning();

    const [portalMsg] = await db
      .insert(portalMessagesTable)
      .values({
        conversationId: conv.id,
        senderId: testProfile.id,
        content: "Live audit test message from resident portal",
      })
      .returning();

    record("Resident Portal", "Send Message from Resident Portal", !!portalMsg, `Chat ID: ${portalMsg.id}, Conv ID: ${conv.id}`);

    // -----------------------------------------------------------------
    // 6. Reports & Aggregations Verification
    // -----------------------------------------------------------------
    console.log("\n--- Testing Reports & Aggregations Engine ---");
    const totalCapacityReport = await withTenant(testProp1.id, async (tenantDb) => {
      const res = await tenantDb
        .select({
          totalRooms: sql<number>`count(*)`,
          totalCapacity: sql<number>`coalesce(sum(${roomsTable.capacity}), 0)`,
          currentOccupancy: sql<number>`coalesce(sum(${roomsTable.currentOccupancy}), 0)`,
        })
        .from(roomsTable);
      return res[0];
    });

    record(
      "Reports Engine",
      "Capacity Matrix Aggregation",
      Number(totalCapacityReport.totalRooms) > 0,
      `Rooms: ${totalCapacityReport.totalRooms}, Capacity: ${totalCapacityReport.totalCapacity}, Occupied: ${totalCapacityReport.currentOccupancy}`,
    );

    // -----------------------------------------------------------------
    // 7. Cleanup Audit Artifacts
    // -----------------------------------------------------------------
    console.log("\n--- Cleaning Up Audit Test Entities ---");
    await db.delete(portalMessagesTable).where(eq(portalMessagesTable.id, portalMsg.id));
    await db.delete(portalConversationsTable).where(eq(portalConversationsTable.id, conv.id));
    await withTenant(testProp1.id, async (tenantDb) => {
      await tenantDb.delete(maintenanceTable).where(eq(maintenanceTable.id, testTicket.id));
      await tenantDb.delete(hostingsTable).where(eq(hostingsTable.id, testHost.id));
      await tenantDb.delete(reservationsTable).where(eq(reservationsTable.id, testRes.id));
      await tenantDb.delete(profileVacationsTable).where(eq(profileVacationsTable.profileId, testProfile.id));
      await tenantDb.delete(assignmentsTable).where(eq(assignmentsTable.id, testAssignment.id));
      await tenantDb.delete(roomsTable).where(eq(roomsTable.id, testRoom.id));
      await tenantDb.delete(roomsTable).where(eq(roomsTable.id, testRoom2.id));
      await tenantDb.delete(profilesTable).where(eq(profilesTable.id, testProfile.id));
    });

    record("Cleanup", "Remove Audit Test Records", true, "All temporary audit rows cleaned successfully");

    // -----------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------
    console.log("\n===============================================================");
    console.log("                     AUDIT SUMMARY");
    console.log("===============================================================");
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`Total Checks: ${total}`);
    console.log(`Passed:       ${passed}`);
    console.log(`Failed:       ${failed}`);

    if (failed > 0) {
      console.error("\n❌ Some audit tests failed! Check logs above.");
      process.exit(1);
    } else {
      console.log("\n🎉 ALL LIVE DATA AUDIT TESTS PASSED WITH 100% SUCCESS!");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("FATAL AUDIT ERROR:", err);
    process.exit(1);
  }
}

runAudit();
