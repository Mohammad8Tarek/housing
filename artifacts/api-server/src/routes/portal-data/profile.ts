import { Router } from "express";
import { withTenant } from "@workspace/db";
import { profilesTable, assignmentsTable, roomsTable, buildingsTable, floorsTable, propertiesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { portalSession } from "../portal-auth/shared.js";
import { logActivity } from "../../lib/activity-logger.js";

const router: Router = Router();

router.get("/profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, sess.profileDbId))
      .limit(1);
    if (!profile) return null;
    return {
      id: profile.id,
      name: `${profile.firstName} ${profile.lastName}`,
      profileId: profile.profileId,
      department: profile.department,
      position: profile.jobTitle,
      photo: profile.photoUrl,
    };
  });
  res.json(result || {});
});

router.get("/room", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sess.profileDbId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!assignment) return null;
    const [room] = await tenantDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assignment.roomId))
      .limit(1);
    if (!room) return null;
    const [building] = await tenantDb
      .select()
      .from(buildingsTable)
      .where(eq(buildingsTable.id, room.buildingId))
      .limit(1);
    const [floor] = await tenantDb
      .select()
      .from(floorsTable)
      .where(eq(floorsTable.id, room.floorId))
      .limit(1);
    const roommates = await tenantDb
      .select()
      .from(assignmentsTable)
      .leftJoin(
        profilesTable,
        eq(assignmentsTable.profileId, profilesTable.id),
      )
      .where(
        and(
          eq(assignmentsTable.roomId, room.id),
          eq(assignmentsTable.status, "ACTIVE"),
          sql`${assignmentsTable.profileId} != ${sess.profileDbId}`,
        ),
      );
    return {
      roomNumber: room.roomNumber,
      building: building?.name,
      floor: floor?.floorNumber,
      assignedSince: assignment.checkInDate,
      roommates: roommates
        .map((r) =>
          r.profiles
            ? {
                id: r.profiles.id,
                name: `${r.profiles.firstName} ${r.profiles.lastName}`,
              }
            : null,
        )
        .filter(Boolean),
    };
  });
  res.json(result || {});
});

router.get("/my-profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const [profile] = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, sess.profileDbId))
      .limit(1);
  });

  if (!profile) {
    res.status(404).json({ success: false, message: "Profile not found" });
    return;
  }

  res.json({
    success: true,
    profile: {
      profileId: profile.profileId,
      fullName: `${profile.firstName} ${profile.lastName}`,
      firstName: profile.firstName,
      lastName: profile.lastName,
      jobTitle: profile.jobTitle,
      department: profile.department,
      nationality: profile.nationality,
      phone: profile.phone,
      gender: profile.gender,
      hireDate: profile.hireDate,
      status: profile.status,
      address: profile.address,
      photoUrl: profile.photoUrl ?? null,
      email: profile.email ?? null,
      emergencyContact: profile.emergencyContact ?? null,
    },
  });
});

router.patch("/my-profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const { phone, address, photo, email, emergencyContact } = req.body;

  const updateData: Record<string, any> = {};
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (photo !== undefined) updateData.photoUrl = photo;
  if (email !== undefined) updateData.email = email;
  if (emergencyContact !== undefined)
    updateData.emergencyContact = emergencyContact;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ success: false, message: "No fields to update" });
    return;
  }

  const [updated] = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.id, sess.profileDbId))
      .returning();
  });

  if (!updated) {
    res.status(404).json({ success: false, message: "Profile not found" });
    return;
  }

  const details = Object.entries(updateData)
    .map(([k, v]) => `${k}: ${k === "photoUrl" ? "(image)" : v}`)
    .join(" | ");

  await logActivity({
    req,
    propertyId: sess.propertyId,
    username: sess.fullName,
    userRole: "profile",
    action: `تحديث البيانات الشخصية من البوابة`,
    actionType: "UPDATE",
    module: "profiles",
    entityType: "profile",
    entityId: updated.id,
    details,
  });

  res.json({
    success: true,
    message: "Profile updated successfully",
    profile: {
      phone: updated.phone,
      address: updated.address,
      photoUrl: updated.photoUrl,
    },
  });
});

router.get("/my-room", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sess.profileDbId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      )
      .limit(1);

    if (!assignment) return { assigned: false };

    const [room] = await tenantDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assignment.roomId))
      .limit(1);
    if (!room) return { assigned: false };

    const [building, floor, property] = await Promise.all([
      tenantDb
        .select()
        .from(buildingsTable)
        .where(eq(buildingsTable.id, room.buildingId))
        .limit(1)
        .then((r) => r[0] ?? null),
      tenantDb
        .select()
        .from(floorsTable)
        .where(eq(floorsTable.id, room.floorId))
        .limit(1)
        .then((r) => r[0] ?? null),
      tenantDb
        .select()
        .from(propertiesTable)
        .where(eq(propertiesTable.id, sess.propertyId))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    const roomAssignments = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.roomId, room.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    const roommates = roomAssignments.filter(
      (a) => a.profileId !== sess.profileDbId,
    ).length;
    const currentOccupancy = roomAssignments.length;

    return {
      assigned: true,
      assignment,
      room,
      building,
      floor,
      property,
      roommates,
      currentOccupancy,
    };
  });

  if (!result.assigned) {
    res.json({ success: true, assigned: false, room: null });
    return;
  }

  const {
    assignment,
    room,
    building,
    floor,
    property,
    roommates,
    currentOccupancy,
  } = result as any;

  res.json({
    success: true,
    assigned: true,
    room: {
      checkInDate: assignment.checkInDate,
      expectedCheckOutDate: assignment.expectedCheckOutDate,
      bedNumber: assignment.bedNumber,

      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      capacity: room.capacity,
      currentOccupancy,
      gender: room.gender,
      status: room.status,
      roommates,

      floor: floor
        ? {
            id: floor.id,
            floorNumber: floor.floorNumber,
            description: floor.description ?? "",
          }
        : null,
      building: building
        ? {
            id: building.id,
            name: building.name,
            location: building.location ?? "",
          }
        : null,
      property: property ? { id: property.id, name: property.name } : null,
    },
  });
});

router.get("/roommates", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  try {
    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const [assignment] = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, sess.profileDbId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);

      if (!assignment) return { roommates: [] };

      const roomAssignments = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, assignment.roomId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      const roommateIds = roomAssignments
        .filter((a) => a.profileId !== sess.profileDbId)
        .map((a) => a.profileId)
        .filter(Boolean);

      if (roommateIds.length === 0) return { roommates: [] };
      // Basic debug logging to help trace portal roommate fetches
      console.debug(
        "[portal-data]/roommates: propertyId=",
        sess.propertyId,
        "profileDbId=",
        sess.profileDbId,
        "roommateCount=",
        roommateIds.length,
      );

      const profiles = await tenantDb
        .select()
        .from(profilesTable)
        .where(inArray(profilesTable.id, roommateIds));

      return {
        roommates: profiles.map((profile: any) => ({
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileCode: profile.profileId,
          email: profile.email,
          phone: profile.phone ?? null,
          department: profile.department ?? "",
          jobTitle: profile.jobTitle ?? null,
          photoUrl: profile.photoUrl ?? null,
        })),
      };
    });

    // Log activity for auditing (only when session present and endpoint executed)
    try {
      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.fullName,
        userRole: "profile",
        action: `جلب رفقاء الغرفة`,
        actionType: "READ",
        module: "profiles",
        entityType: "room",
        entityId: (result as any)?.roomId ?? null,
        details: `roommateCount=${(result.roommates || []).length}`,
      });
    } catch (e) {
      console.warn("Failed to log portal roommates activity:", e);
    }

    res.json({ success: true, roommates: result.roommates ?? [] });
  } catch (err) {
    console.error("/roommates error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
