import {
  db,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
  propertiesTable,
  maintenanceTable,
  roomLocksTable,
  hostingsTable,
  profilePortalAccountsTable,
  activityRegistrationsTable,
  evaluationsTable,
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
 * Completely removes a profile and all its related records from the source property schema
 * when an employee is permanently housed/transferred to another hotel property.
 * Prevents duplicates and ensures profiles are not counted twice.
 */
export async function deleteSourceProfileOnTransfer(
  sourcePropertyId: number,
  sourceProfileId: number,
): Promise<boolean> {
  return await withTenant(sourcePropertyId, async (srcDb) => {
    const [srcProfile] = await srcDb
      .select({
        id: profilesTable.id,
        profileId: profilesTable.profileId,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, sourceProfileId));

    if (!srcProfile) {
      console.log(`[cross-property] Profile #${sourceProfileId} already absent from property #${sourcePropertyId}`);
      return false;
    }

    console.log(
      `[cross-property] 🗑️ Deleting source profile #${sourceProfileId} (${srcProfile.firstName} ${srcProfile.lastName}, code: ${srcProfile.profileId}) from property #${sourcePropertyId} to prevent duplicates`,
    );

    // 1. Unlink key_audit_log for keys associated with this profile or its assignments
    await srcDb.execute(sql`
      UPDATE key_audit_log
      SET key_id = NULL
      WHERE key_id IN (
        SELECT id FROM room_keys
        WHERE profile_id = ${sourceProfileId}
           OR assignment_id IN (SELECT id FROM assignments WHERE profile_id = ${sourceProfileId})
      )
    `).catch((e) => console.warn(`[cross-property] unlink key_audit_log warning:`, e?.message));

    // 2. Delete room keys associated with this profile
    await srcDb.execute(sql`
      DELETE FROM room_keys
      WHERE profile_id = ${sourceProfileId}
         OR assignment_id IN (SELECT id FROM assignments WHERE profile_id = ${sourceProfileId})
    `).catch((e) => console.warn(`[cross-property] delete room_keys warning:`, e?.message));

    // 3. Unlink maintenance tickets assigned to this profile
    await srcDb.execute(sql`
      UPDATE maintenance
      SET assigned_to = NULL
      WHERE assigned_to = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] unlink maintenance warning:`, e?.message));

    // 4. Delete hosting companions
    await srcDb.execute(sql`
      DELETE FROM hosting_companions
      WHERE hosting_id IN (SELECT id FROM hostings WHERE profile_id = ${sourceProfileId})
    `).catch((e) => console.warn(`[cross-property] delete hosting_companions warning:`, e?.message));

    // 5. Delete hostings
    await srcDb.execute(sql`
      DELETE FROM hostings
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete hostings warning:`, e?.message));

    // 6. Delete profile vacations
    await srcDb.execute(sql`
      DELETE FROM profile_vacations
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete vacations warning:`, e?.message));

    // 7. Delete profile documents (already copied to target property)
    await srcDb.execute(sql`
      DELETE FROM profile_documents
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete documents warning:`, e?.message));

    // 8. Delete activity registrations
    await srcDb.execute(sql`
      DELETE FROM activity_registrations
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete activity_registrations warning:`, e?.message));

    // 9. Delete evaluations
    await srcDb.execute(sql`
      DELETE FROM evaluations
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete evaluations warning:`, e?.message));

    // 10. Delete assignments in source property
    await srcDb.execute(sql`
      DELETE FROM assignments
      WHERE profile_id = ${sourceProfileId}
    `).catch((e) => console.warn(`[cross-property] delete assignments warning:`, e?.message));

    // 11. Delete portal account if exists in source
    if (srcProfile.profileId) {
      await srcDb.execute(sql`
        DELETE FROM profile_portal_accounts
        WHERE profile_id = ${srcProfile.profileId}
      `).catch((e) => console.warn(`[cross-property] delete portal account warning:`, e?.message));
    }

    // 12. Delete the profile itself from source property
    await srcDb.execute(sql`
      DELETE FROM profiles
      WHERE id = ${sourceProfileId}
    `);

    // 10. Real-time broadcast to source property clients
    broadcastToProperty(sourcePropertyId, {
      module: "profiles",
      action: "deleted",
      entityId: sourceProfileId,
    });
    broadcastToProperty(sourcePropertyId, {
      module: "dashboard",
      action: "sync",
    });

    console.log(
      `[cross-property] ✅ Successfully deleted profile #${sourceProfileId} from property #${sourcePropertyId}`,
    );
    return true;
  });
}

/**
 * Cleanly close active stay in source property and delete profile when permanent transfer occurs.
 */
export async function closeSourceAssignmentOnTransfer(
  sourcePropertyId: number,
  sourceProfileId: number,
  targetPropertyName: string,
) {
  // Update rooms in source property first to release capacity
  await withTenant(sourcePropertyId, async (srcDb) => {
    const activeAssignments = await srcDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sourceProfileId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    for (const oldAssignment of activeAssignments) {
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
  });

  // Permanently delete profile from source property to prevent duplicate counts
  await deleteSourceProfileOnTransfer(sourcePropertyId, sourceProfileId);
  return true;
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

  // Target WebSocket broadcasts
  broadcastToProperty(targetPropertyId, { module: "accommodation", action: "created", entityId: createdInTarget.id });
  broadcastToProperty(targetPropertyId, { module: "housing", action: "updated", entityId: newRoom.id });
  broadcastToProperty(targetPropertyId, { module: "dashboard", action: "sync" });

  // 7. Delete transferred profile from source property so it is not duplicated
  await deleteSourceProfileOnTransfer(sourcePropertyId, oldAssignment.profileId).catch((delErr) => {
    console.warn("[cross-property] deleteSourceProfileOnTransfer in executeCrossPropertyTransfer warning:", delErr?.message);
  });

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

/**
 * Locate a profile by primary key ID across any property tenant schema.
 */
export async function findProfileAcrossAllProperties(sourceProfileId: number): Promise<{ propertyId: number; profile: any } | null> {
  const allProperties = await db
    .select({ id: propertiesTable.id, name: propertiesTable.name })
    .from(propertiesTable);

  for (const prop of allProperties) {
    try {
      const [found] = await withTenant(prop.id, async (tenantDb) => {
        return tenantDb
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.id, sourceProfileId))
          .limit(1);
      });
      if (found) {
        return { propertyId: prop.id, profile: found };
      }
    } catch (err) {
      // Continue searching next property
    }
  }

  return null;
}

/**
 * Self-healing routine to detect and resolve orphan assignments across all hotel schemas.
 * Clones the profile into the local tenant schema and updates the assignment profile_id.
 */
export async function healOrphanAssignments(): Promise<number> {
  let healedCount = 0;
  try {
    const allProperties = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name })
      .from(propertiesTable);

    for (const prop of allProperties) {
      const orphanAssignments = await withTenant(prop.id, async (tenantDb) => {
        const rows = await tenantDb
          .select({
            id: assignmentsTable.id,
            profileId: assignmentsTable.profileId,
            roomId: assignmentsTable.roomId,
            status: assignmentsTable.status,
          })
          .from(assignmentsTable)
          .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
          .where(
            and(
              sql`${profilesTable.id} IS NULL`,
              sql`lower(${assignmentsTable.status}) = 'active'`
            )
          );
        return rows;
      }).catch(() => []);

      for (const orphan of orphanAssignments) {
        if (!orphan.profileId) continue;
        console.log(`[auto-heal] Found orphan assignment #${orphan.id} in property ${prop.id} referencing missing profile ID ${orphan.profileId}`);

        const foundSource = await findProfileAcrossAllProperties(orphan.profileId);
        if (foundSource && foundSource.propertyId !== prop.id) {
          console.log(`[auto-heal] Located missing profile in source property ${foundSource.propertyId} (${foundSource.profile.firstName} ${foundSource.profile.lastName})`);
          
          const { targetProfile, targetName, srcName } = await syncProfileAcrossProperties({
            sourcePropertyId: foundSource.propertyId,
            targetPropertyId: prop.id,
            sourceProfileId: foundSource.profile.id,
            transferType: "PERMANENT",
          });

          await withTenant(prop.id, async (tenantDb) => {
            await tenantDb
              .update(assignmentsTable)
              .set({
                profileId: targetProfile.id,
                notes: sql`COALESCE(${assignmentsTable.notes}, '') || ' ' || ${`[تم تصحيح ومزامنة الملف من ${srcName}]`}`,
              })
              .where(eq(assignmentsTable.id, orphan.id));

            await tenantDb
              .update(profilesTable)
              .set({ status: "ACTIVE" })
              .where(eq(profilesTable.id, targetProfile.id));
          });

          // Close source assignment if still active in source property
          await closeSourceAssignmentOnTransfer(
            foundSource.propertyId,
            foundSource.profile.id,
            targetName
          ).catch((e) => console.warn(`[auto-heal] closeSourceAssignment warning:`, e?.message));

          healedCount++;
          console.log(`[auto-heal] ✅ Healed assignment #${orphan.id} in property ${prop.id} -> Linked to local profile #${targetProfile.id} (${targetProfile.firstName} ${targetProfile.lastName})`);
        }
      }
    }

    // Run duplicate cleanup across properties
    const dedupedCount = await cleanupDuplicateTransferredProfiles();
    if (dedupedCount > 0) {
      console.log(`[auto-heal] 🧹 Cleaned up ${dedupedCount} duplicate transferred profiles across properties.`);
    }
  } catch (err: any) {
    console.error("[auto-heal] Error during healOrphanAssignments:", err?.message || err);
  }

  return healedCount;
}

/**
 * Deduplicate profiles across all hotel property schemas.
 * Ensures each employee (by staff profileId or nationalId) exists in ONLY ONE property.
 * If duplicates are found across properties:
 * - The profile with an ACTIVE assignment is prioritized as primary.
 * - If neither has an active assignment, the most recently assigned or created profile is prioritized.
 * - All other duplicate profiles are permanently deleted from their old properties.
 */
export async function cleanupDuplicateTransferredProfiles(): Promise<number> {
  let cleanedCount = 0;
  try {
    const allProperties = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name })
      .from(propertiesTable);

    interface ProfileEntry {
      propertyId: number;
      id: number;
      profileId: string;
      nationalId: string;
      firstName: string;
      lastName: string;
      status: string;
      createdAt: Date | string | null;
      hasActiveAssignment: boolean;
      latestAssignmentDate: string | null;
    }

    const allProfiles: ProfileEntry[] = [];

    for (const prop of allProperties) {
      const pRows = await withTenant(prop.id, async (tenantDb) => {
        return tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            nationalId: profilesTable.nationalId,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
            status: profilesTable.status,
            createdAt: profilesTable.createdAt,
          })
          .from(profilesTable);
      }).catch(() => []);

      for (const p of pRows) {
        const assignInfo = await withTenant(prop.id, async (tenantDb) => {
          const rows = await tenantDb
            .select({
              id: assignmentsTable.id,
              status: assignmentsTable.status,
              createdAt: assignmentsTable.createdAt,
            })
            .from(assignmentsTable)
            .where(eq(assignmentsTable.profileId, p.id));

          const hasActive = rows.some((r) => r.status?.toLowerCase() === "active");
          const latest = rows.length > 0
            ? rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0].createdAt
            : null;

          return {
            hasActive,
            latestDate: latest ? new Date(latest).toISOString() : null,
          };
        }).catch(() => ({ hasActive: false, latestDate: null }));

        allProfiles.push({
          propertyId: prop.id,
          id: p.id,
          profileId: p.profileId?.trim() || "",
          nationalId: p.nationalId?.trim() || "",
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          status: p.status || "",
          createdAt: p.createdAt,
          hasActiveAssignment: assignInfo.hasActive,
          latestAssignmentDate: assignInfo.latestDate,
        });
      }
    }

    const groups: Map<string, ProfileEntry[]> = new Map();

    for (const p of allProfiles) {
      const key = p.profileId || (p.nationalId ? `nat_${p.nationalId}` : null);
      if (!key) continue;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    }

    for (const [key, list] of groups.entries()) {
      const propertyIds = new Set(list.map((item) => item.propertyId));
      if (propertyIds.size <= 1) continue;

      list.sort((a, b) => {
        if (a.hasActiveAssignment && !b.hasActiveAssignment) return -1;
        if (!a.hasActiveAssignment && b.hasActiveAssignment) return 1;

        if (a.latestAssignmentDate && b.latestAssignmentDate) {
          return new Date(b.latestAssignmentDate).getTime() - new Date(a.latestAssignmentDate).getTime();
        }
        if (a.latestAssignmentDate && !b.latestAssignmentDate) return -1;
        if (!a.latestAssignmentDate && b.latestAssignmentDate) return 1;

        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;

        return b.id - a.id;
      });

      const primary = list[0];
      const duplicatesToDelete = list.slice(1);

      for (const dup of duplicatesToDelete) {
        if (dup.propertyId === primary.propertyId && dup.id === primary.id) continue;

        console.log(
          `[dedup] Deleting duplicate profile #${dup.id} in property #${dup.propertyId} (${dup.firstName} ${dup.lastName}, code: ${dup.profileId}) -> Primary is #${primary.id} in property #${primary.propertyId}`,
        );

        await deleteSourceProfileOnTransfer(dup.propertyId, dup.id);
        cleanedCount++;
      }
    }
  } catch (err: any) {
    console.error("[dedup] Error during cleanupDuplicateTransferredProfiles:", err?.message || err);
  }

  return cleanedCount;
}


