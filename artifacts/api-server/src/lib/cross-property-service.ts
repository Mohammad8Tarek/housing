import {
  db,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  assignmentsTable,
  roomsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, or, sql, not, count } from "drizzle-orm";
import { broadcastToProperty } from "./websocket.js";
import { logActivity } from "./activity-logger.js";
import { su } from "./request-utils.js";

export interface SyncProfileOptions {
  sourcePropertyId: number;
  targetPropertyId: number;
  sourceProfileId: number;
  transferType?: "PERMANENT" | "TASK_FORCE";
}

/**
 * Synchronize or find an employee profile across hotel property schemas.
 * Ensures the target tenant schema has a valid local profile record matching
 * the employee's national ID or staff profile ID.
 */
export async function syncProfileAcrossProperties(options: SyncProfileOptions) {
  const { sourcePropertyId, targetPropertyId, sourceProfileId, transferType = "PERMANENT" } = options;

  // 1. Fetch source profile details
  const [sourceProfile] = await withTenant(sourcePropertyId, async (srcDb) => {
    return srcDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, sourceProfileId))
      .limit(1);
  });

  if (!sourceProfile) {
    throw new Error(`Profile with ID ${sourceProfileId} not found in source property ${sourcePropertyId}`);
  }

  // 2. Fetch property names for metadata notes
  const [srcProp] = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, sourcePropertyId));

  const [targetProp] = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, targetPropertyId));

  const srcName = srcProp?.name || `Hotel #${sourcePropertyId}`;
  const targetName = targetProp?.name || `Hotel #${targetPropertyId}`;

  // 3. Locate or insert profile in target tenant schema
  const targetProfile = await withTenant(targetPropertyId, async (targetDb) => {
    const conditions = [];
    if (sourceProfile.nationalId && sourceProfile.nationalId.trim().length > 0) {
      conditions.push(eq(profilesTable.nationalId, sourceProfile.nationalId.trim()));
    }
    if (sourceProfile.profileId && sourceProfile.profileId.trim().length > 0) {
      conditions.push(eq(profilesTable.profileId, sourceProfile.profileId.trim()));
    }

    let existing: typeof sourceProfile | null = null;
    if (conditions.length > 0) {
      const found = await targetDb
        .select()
        .from(profilesTable)
        .where(or(...conditions))
        .limit(1);
      if (found.length > 0) existing = found[0];
    }

    if (existing) {
      // Update with latest personal & job info from source
      const [updated] = await targetDb
        .update(profilesTable)
        .set({
          firstName: sourceProfile.firstName,
          lastName: sourceProfile.lastName,
          thirdName: sourceProfile.thirdName || existing.thirdName,
          fourthName: sourceProfile.fourthName || existing.fourthName,
          jobTitle: sourceProfile.jobTitle || existing.jobTitle,
          department: sourceProfile.department || existing.department,
          level: sourceProfile.level || existing.level,
          phone: sourceProfile.phone || existing.phone,
          email: sourceProfile.email || existing.email,
          nationality: sourceProfile.nationality || existing.nationality,
          address: sourceProfile.address || existing.address,
          photoUrl: sourceProfile.photoUrl || existing.photoUrl,
          idImage: sourceProfile.idImage || existing.idImage,
          emergencyContact: sourceProfile.emergencyContact || existing.emergencyContact,
          contractEndDate: sourceProfile.contractEndDate || existing.contractEndDate,
        })
        .where(eq(profilesTable.id, existing.id))
        .returning();
      return updated;
    }

    // Insert new cloned profile in target tenant schema
    const prefixNote = transferType === "TASK_FORCE"
      ? `[انتداب مؤقت من فندق: ${srcName}]`
      : `[منقول من فندق: ${srcName}]`;

    const [inserted] = await targetDb
      .insert(profilesTable)
      .values({
        profileId: sourceProfile.profileId,
        firstName: sourceProfile.firstName,
        lastName: sourceProfile.lastName,
        thirdName: sourceProfile.thirdName || "",
        fourthName: sourceProfile.fourthName || "",
        nationalId: sourceProfile.nationalId,
        nationality: sourceProfile.nationality || "",
        address: sourceProfile.address || "",
        jobTitle: sourceProfile.jobTitle || "",
        level: sourceProfile.level || "",
        phone: sourceProfile.phone || "",
        department: sourceProfile.department || "",
        status: "UNASSIGNED",
        hireDate: sourceProfile.hireDate || new Date().toISOString().split("T")[0],
        gender: sourceProfile.gender || "M",
        employmentType: sourceProfile.employmentType || "INTERNAL",
        companyName: sourceProfile.companyName || "",
        idImage: sourceProfile.idImage,
        photoUrl: sourceProfile.photoUrl,
        email: sourceProfile.email || "",
        emergencyContact: sourceProfile.emergencyContact || "",
        dateOfBirth: sourceProfile.dateOfBirth || "",
        contractEndDate: sourceProfile.contractEndDate,
      })
      .returning();

    return inserted;
  });

  // 4. Copy uploaded identification documents to target property
  try {
    const docs = await withTenant(sourcePropertyId, async (srcDb) => {
      return srcDb
        .select()
        .from(profileDocumentsTable)
        .where(eq(profileDocumentsTable.profileId, sourceProfileId));
    });

    if (docs && docs.length > 0) {
      await withTenant(targetPropertyId, async (targetDb) => {
        for (const doc of docs) {
          const existingDoc = await targetDb
            .select({ id: profileDocumentsTable.id })
            .from(profileDocumentsTable)
            .where(
              and(
                eq(profileDocumentsTable.profileId, targetProfile.id),
                eq(profileDocumentsTable.fileName, doc.fileName),
              ),
            )
            .limit(1);

          if (existingDoc.length === 0) {
            await targetDb.insert(profileDocumentsTable).values({
              profileId: targetProfile.id,
              fileName: doc.fileName,
              fileType: doc.fileType,
              fileData: doc.fileData,
              uploadedAt: doc.uploadedAt,
            });
          }
        }
      });
    }
  } catch (docErr) {
    console.warn("[cross-property] Document sync warning:", docErr);
  }

  return { targetProfile, sourceProfile, srcProp, targetProp, srcName, targetName };
}

/**
 * Cleanly close active stay in source property when permanent transfer occurs.
 */
export async function closeSourceAssignmentOnTransfer(
  sourcePropertyId: number,
  sourceProfileId: number,
  targetPropertyName: string,
) {
  return await withTenant(sourcePropertyId, async (srcDb) => {
    const activeAssignments = await srcDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sourceProfileId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    if (activeAssignments.length === 0) return null;

    for (const oldAssignment of activeAssignments) {
      const nowStr = new Date().toISOString();
      await srcDb
        .update(assignmentsTable)
        .set({
          status: "TRANSFERRED",
          checkOutDate: nowStr,
          notes: oldAssignment.notes
            ? `${oldAssignment.notes} | تم النقل إلى فندق: ${targetPropertyName}`
            : `تم النقل إلى فندق: ${targetPropertyName}`,
        })
        .where(eq(assignmentsTable.id, oldAssignment.id));

      const [room] = await srcDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, oldAssignment.roomId));

      if (room) {
        const [remainingCount] = await srcDb
          .select({ count: count() })
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.roomId, room.id),
              sql`lower(${assignmentsTable.status}) = 'active'`,
              not(eq(assignmentsTable.id, oldAssignment.id)),
            ),
          );

        const newOcc = oldAssignment.isEntireRoom ? 0 : Number(remainingCount?.count ?? 0);
        const nextRoomStatus = newOcc === 0 ? "dirty" : "occupied_dirty";

        await srcDb
          .update(roomsTable)
          .set({
            currentOccupancy: newOcc,
            status: nextRoomStatus,
          })
          .where(eq(roomsTable.id, room.id));

        broadcastToProperty(sourcePropertyId, {
          module: "housing",
          action: "updated",
          entityId: room.id,
        });
      }

      broadcastToProperty(sourcePropertyId, {
        module: "accommodation",
        action: "transfer",
        entityId: oldAssignment.id,
      });
    }

    // Set profile status in source property to LEFT
    await srcDb
      .update(profilesTable)
      .set({ status: "LEFT" })
      .where(eq(profilesTable.id, sourceProfileId));

    broadcastToProperty(sourcePropertyId, { module: "dashboard", action: "sync" });
    return true;
  });
}

export interface CrossPropertyTransferParams {
  sourcePropertyId: number;
  targetPropertyId: number;
  assignmentId: number;
  newRoomId: number;
  newBedNumber?: number;
  transferReason?: string;
  isEntireRoom?: boolean;
  isTemporaryVacationOverride?: boolean;
  req: any;
}

/**
 * Full cross-tenant transfer execution when moving a resident from Property A to Property B.
 */
export async function executeCrossPropertyTransfer(params: CrossPropertyTransferParams) {
  const {
    sourcePropertyId,
    targetPropertyId,
    assignmentId,
    newRoomId,
    newBedNumber,
    transferReason,
    isEntireRoom: reqEntireRoom,
    isTemporaryVacationOverride,
    req,
  } = params;

  // 1. Fetch source assignment & old room
  const sourceData = await withTenant(sourcePropertyId, async (srcDb) => {
    const [assignment] = await srcDb
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId));
    if (!assignment) return null;

    const [oldRoom] = await srcDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assignment.roomId));

    return { assignment, oldRoom };
  });

  if (!sourceData || !sourceData.assignment) {
    return { error: "Assignment not found in source property", status: 404, code: "ASSIGNMENT_NOT_FOUND" };
  }

  const { assignment: oldAssignment, oldRoom } = sourceData;

  // 2. Validate target room in target property
  const targetRoomCheck = await withTenant(targetPropertyId, async (tgtDb) => {
    const [newRoom] = await tgtDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, newRoomId));
    if (!newRoom) {
      return { error: "New room not found in target property", status: 404, code: "ROOM_NOT_FOUND" };
    }

    const roomStatus = newRoom.status?.toLowerCase() || "";
    if (["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(roomStatus)) {
      return {
        error: `لا يمكن النقل إلى هذه الغرفة لأنها غير صالحة للسكن حالياً (الحالة: ${newRoom.status}).`,
        code: "ROOM_NOT_ELIGIBLE",
        status: 400,
      };
    }

    const [existingEntireRoom] = await tgtDb
      .select({
        id: assignmentsTable.id,
        profileId: assignmentsTable.profileId,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
      })
      .from(assignmentsTable)
      .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
      .where(
        and(
          eq(assignmentsTable.roomId, newRoomId),
          eq(assignmentsTable.status, "ACTIVE"),
          eq(assignmentsTable.isEntireRoom, true),
        ),
      );

    if (existingEntireRoom) {
      return {
        error: `الغرفة الجديدة مخصصة بالكامل لموظف آخر (${existingEntireRoom.firstName} ${existingEntireRoom.lastName}) كغرفة خاصة بالكامل.`,
        code: "ROOM_ENTIRE_OCCUPIED",
        status: 409,
      };
    }

    const isEntireRoomRequested = Boolean(
      reqEntireRoom || (oldAssignment.isEntireRoom && newRoom.currentOccupancy === 0)
    );

    if (isEntireRoomRequested && newRoom.currentOccupancy > 0) {
      return {
        error: `لا يمكن تخصيص الغرفة الجديدة بالكامل لوجود مقيمين حاليين بها (${newRoom.currentOccupancy} مقيم).`,
        code: "ROOM_NOT_EMPTY_FOR_ENTIRE",
        status: 409,
      };
    }

    if (newBedNumber && !isEntireRoomRequested) {
      const takenBeds = await tgtDb
        .select({
          id: assignmentsTable.id,
          profileId: assignmentsTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          profileStatus: profilesTable.status,
          vacationEndDate: profilesTable.vacationEndDate,
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .where(
          and(
            eq(assignmentsTable.roomId, newRoomId),
            eq(assignmentsTable.bedNumber, newBedNumber),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      if (takenBeds.length > 0) {
        const occupant = takenBeds[0];
        const isVac = occupant.profileStatus?.toUpperCase() === "VACATION";
        if (!isVac) {
          return {
            error: `السرير رقم ${newBedNumber} في الغرفة الجديدة مشغول حالياً بالموظف (${occupant.firstName} ${occupant.lastName}).`,
            code: "BED_TAKEN",
            status: 409,
          };
        }
        if (!isTemporaryVacationOverride) {
          return {
            error: `السرير رقم ${newBedNumber} محجوز للموظف (${occupant.firstName} ${occupant.lastName}) وهو في إجازة حالياً${occupant.vacationEndDate ? ` حتى ${occupant.vacationEndDate}` : ""}. هل ترغب في تأكيد النقل المؤقت كبديل؟`,
            code: "BED_OCCUPANT_ON_VACATION",
            occupantName: `${occupant.firstName} ${occupant.lastName}`,
            vacationEndDate: occupant.vacationEndDate,
            canOverride: true,
            status: 409,
          };
        }
      }
    }

    if (newRoom.currentOccupancy >= newRoom.capacity && !isTemporaryVacationOverride) {
      return {
        error: `الغرفة الجديدة ممتلئة تماماً (${newRoom.capacity}/${newRoom.capacity} سرير).`,
        code: "ROOM_FULL",
        status: 409,
      };
    }

    return { newRoom, isEntireRoomRequested };
  });

  if ("error" in targetRoomCheck) {
    return targetRoomCheck;
  }

  const { newRoom, isEntireRoomRequested } = targetRoomCheck;

  // 3. Sync profile from source property to target property
  const { targetProfile, srcName, targetName } = await syncProfileAcrossProperties({
    sourcePropertyId,
    targetPropertyId,
    sourceProfileId: oldAssignment.profileId,
    transferType: "PERMANENT",
  });

  // 4. Close previous assignment and update old room in source property
  const nowStr = new Date().toISOString();
  await withTenant(sourcePropertyId, async (srcDb) => {
    await srcDb
      .update(assignmentsTable)
      .set({
        status: "TRANSFERRED",
        checkOutDate: nowStr,
        notes: [
          oldAssignment.notes,
          `تم النقل إلى فندق ${targetName} - الغرفة ${newRoom.roomNumber}`,
          transferReason ? `السبب: ${transferReason}` : null,
        ].filter(Boolean).join(" | "),
      })
      .where(eq(assignmentsTable.id, oldAssignment.id));

    if (oldRoom) {
      const [oldRemaining] = await srcDb
        .select({ count: count() })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, oldRoom.id),
            sql`lower(${assignmentsTable.status}) = 'active'`,
            not(eq(assignmentsTable.id, oldAssignment.id)),
          ),
        );
      const oldOcc = oldAssignment.isEntireRoom ? 0 : Number(oldRemaining?.count ?? 0);
      await srcDb
        .update(roomsTable)
        .set({
          currentOccupancy: oldOcc,
          status: oldOcc === 0 ? "dirty" : "occupied_dirty",
        })
        .where(eq(roomsTable.id, oldRoom.id));
    }

    await srcDb
      .update(profilesTable)
      .set({ status: "LEFT" })
      .where(eq(profilesTable.id, oldAssignment.profileId));
  });

  // 5. Create new assignment and update new room in target property
  const createdInTarget = await withTenant(targetPropertyId, async (tgtDb) => {
    const [newRemaining] = await tgtDb
      .select({ count: count() })
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.roomId, newRoom.id),
          sql`lower(${assignmentsTable.status}) = 'active'`,
        ),
      );

    const newOcc = isEntireRoomRequested
      ? newRoom.capacity
      : (isTemporaryVacationOverride ? Number(newRemaining?.count ?? 0) : Number(newRemaining?.count ?? 0) + 1);

    await tgtDb
      .update(roomsTable)
      .set({
        currentOccupancy: newOcc,
        status: "occupied",
      })
      .where(eq(roomsTable.id, newRoom.id));

    const finalNotes = [
      `تم النقل بين الفنادق من ${srcName} (الغرفة ${oldRoom?.roomNumber || oldAssignment.roomId})`,
      transferReason ? `السبب: ${transferReason}` : null,
    ].filter(Boolean).join(" | ");

    const [newAssignment] = await tgtDb
      .insert(assignmentsTable)
      .values({
        profileId: targetProfile.id,
        roomId: newRoom.id,
        bedNumber: isEntireRoomRequested ? (newBedNumber || 1) : (newBedNumber ?? null),
        isEntireRoom: isEntireRoomRequested,
        checkInDate: nowStr,
        expectedCheckOutDate: oldAssignment.expectedCheckOutDate,
        notes: finalNotes,
        status: "ACTIVE",
      })
      .returning();

    await tgtDb
      .update(profilesTable)
      .set({ status: "ACTIVE" })
      .where(eq(profilesTable.id, targetProfile.id));

    return newAssignment;
  });

  // 6. Log activities and emit WebSockets to both source and target properties
  const s = su(req);
  const oldRoomNum = oldRoom?.roomNumber ?? "?";
  const newRoomNum = newRoom.roomNumber;

  // Log in source property
  await logActivity({
    req,
    propertyId: sourcePropertyId,
    username: s.username,
    userId: s.userId,
    userRole: s.userRole,
    action: `نقل موظف #${oldAssignment.profileId} من الغرفة ${oldRoomNum} إلى فندق ${targetName} الغرفة ${newRoomNum}`,
    actionType: "TRANSFER",
    module: "accommodation",
    entityType: "assignment",
    entityId: oldAssignment.id,
    details: {
      fromPropertyId: sourcePropertyId,
      toPropertyId: targetPropertyId,
      fromRoomNumber: oldRoomNum,
      toRoomNumber: newRoomNum,
      transferredBy: s.username,
      reason: transferReason,
    },
  });

  // Log in target property
  await logActivity({
    req,
    propertyId: targetPropertyId,
    username: s.username,
    userId: s.userId,
    userRole: s.userRole,
    action: `استقبال موظف محوّل من فندق ${srcName} في الغرفة ${newRoomNum}`,
    actionType: "ASSIGN",
    module: "accommodation",
    entityType: "assignment",
    entityId: createdInTarget.id,
    details: {
      fromPropertyId: sourcePropertyId,
      toPropertyId: targetPropertyId,
      fromRoomNumber: oldRoomNum,
      toRoomNumber: newRoomNum,
      profileId: targetProfile.id,
      receivedBy: s.username,
    },
  });

  // WebSocket broadcasts
  broadcastToProperty(sourcePropertyId, { module: "accommodation", action: "transfer", entityId: oldAssignment.id });
  if (oldRoom) {
    broadcastToProperty(sourcePropertyId, { module: "housing", action: "updated", entityId: oldRoom.id });
  }
  broadcastToProperty(sourcePropertyId, { module: "dashboard", action: "sync" });

  broadcastToProperty(targetPropertyId, { module: "accommodation", action: "created", entityId: createdInTarget.id });
  broadcastToProperty(targetPropertyId, { module: "housing", action: "updated", entityId: newRoom.id });
  broadcastToProperty(targetPropertyId, { module: "dashboard", action: "sync" });

  return {
    success: true,
    updated: createdInTarget,
    oldRoom,
    newRoom,
    targetProfile,
    sourcePropertyId,
    targetPropertyId,
  };
}
