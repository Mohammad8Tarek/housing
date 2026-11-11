import { Router } from "express";
import {
  db,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  propertiesTable,
  lookupValuesTable,
} from "@workspace/db";
import { eq, and, or, SQL } from "drizzle-orm";
import {
  UpdateProfileBody,
  UpdateProfileParams,
  DeleteProfileParams,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { moveOrEnsureProfilePortalAccount } from "../../lib/portal-accounts.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { enrichProfileBilingual } from "../../lib/bilingual-translator.js";
import { resolveProfileTenant, normalizePhotoData } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import {
  IdParams,
  ProfilePhotoBody,
  ProfileIdImageBody,
} from "../../validation/schemas.js";

const router: Router = Router();

router.patch(
  "/profiles/:id",
  requirePermission("profiles", "edit"),
  validate({ params: IdParams }),
  async (req, res): Promise<void> => {
    const params = UpdateProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    let propertyId = getTenantId(req);
    let profileExistsInTenant = false;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.id, params.data.id))
            .limit(1);
        });
        if (found) profileExistsInTenant = true;
      } catch {}
    }

    if (!profileExistsInTenant) {
      const authUser = (req as any).authUser;
      const isSysAdmin =
        authUser?.isSystemAdmin ||
        authUser?.roles?.some((r: any) =>
          ["super_admin", "system_admin"].includes(String(r).toLowerCase()),
        );
      const allowedPids: number[] = Array.isArray(authUser?.propertyIds)
        ? authUser.propertyIds.map(Number).filter(Boolean)
        : authUser?.propertyId
          ? [Number(authUser.propertyId)]
          : [];

      try {
        const props = await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          if (!isSysAdmin && !allowedPids.includes(p.id)) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select({ id: profilesTable.id })
                .from(profilesTable)
                .where(eq(profilesTable.id, params.data.id))
                .limit(1);
            });
            if (found) {
              propertyId = p.id;
              profileExistsInTenant = true;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profileExistsInTenant || !propertyId) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate profile ID, national ID, or phone on update ────
    const body = parsed.data as Record<string, any>;
    if (
      body.profileId ||
      body.nationalId ||
      (body.phone && body.phone.trim())
    ) {
      const existingEmp = await withTenant(propertyId, async (tenantDb) => {
        const conditions: SQL[] = [];
        if (body.profileId)
          conditions.push(eq(profilesTable.profileId, body.profileId));
        if (body.nationalId)
          conditions.push(eq(profilesTable.nationalId, body.nationalId));
        if (body.phone && body.phone.trim())
          conditions.push(eq(profilesTable.phone, body.phone.trim()));
        return await tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            nationalId: profilesTable.nationalId,
            phone: profilesTable.phone,
          })
          .from(profilesTable)
          .where(or(...conditions));
      });

      const conflict = existingEmp.find((e) => e.id !== params.data.id);
      if (conflict) {
        let reason = "Profile already exists";
        if (conflict.profileId === body.profileId)
          reason = `كود الملف ${body.profileId} مسجل مسبقاً (Profile ID already exists)`;
        else if (conflict.nationalId === body.nationalId)
          reason = `رقم الهوية ${body.nationalId} مسجل مسبقاً (National ID already exists)`;
        else if (body.phone && conflict.phone === body.phone.trim())
          reason = `رقم الهاتف ${body.phone} مسجل مسبقاً (Phone number already exists)`;
        res.status(409).json({ error: reason, code: "PROFILE_DUPLICATE" });
        return;
      }
    }

    const { previous, updated } = await withTenant(
      propertyId,
      async (tenantDb) => {
        const [existing] = await tenantDb
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.id, params.data.id))
          .limit(1);
        if (!existing) return { previous: null, updated: null };

        const { idDocuments } = parsed.data as any;

        const allowedProfileColumns = [
          "profileId",
          "firstName",
          "lastName",
          "thirdName",
          "fourthName",
          "firstNameAr",
          "lastNameAr",
          "thirdNameAr",
          "fourthNameAr",
          "nationalId",
          "nationality",
          "address",
          "jobTitle",
          "jobTitleAr",
          "level",
          "phone",
          "department",
          "departmentAr",
          "status",
          "hireDate",
          "gender",
          "employmentType",
          "companyName",
          "idImage",
          "photoUrl",
          "email",
          "emergencyContact",
          "dateOfBirth",
          "vacationStartDate",
          "vacationEndDate",
          "vacationNotes",
          "contractEndDate",
        ];

        const cleanProfileData: Record<string, any> = {};
        for (const col of allowedProfileColumns) {
          if (col in parsed.data && (parsed.data as any)[col] !== undefined) {
            cleanProfileData[col] = (parsed.data as any)[col];
          }
        }

        // Dual-Layer RBAC & Data Integrity: Level cannot be manually modified — it is pulled direct from HR / job title lookup
        if (existing.employmentType !== "THIRD_PARTY" && existing.level) {
          if (
            cleanProfileData.jobTitle &&
            cleanProfileData.jobTitle !== existing.jobTitle
          ) {
            const [jtLookup] = await tenantDb
              .select()
              .from(lookupValuesTable)
              .where(
                and(
                  eq(lookupValuesTable.category, "job_title"),
                  eq(lookupValuesTable.value, cleanProfileData.jobTitle),
                ),
              )
              .limit(1);
            cleanProfileData.level = jtLookup?.extraValue || existing.level;
          } else {
            cleanProfileData.level = existing.level;
          }
        }

        const enrichedPatch = enrichProfileBilingual({
          firstName: cleanProfileData.firstName ?? existing.firstName,
          lastName: cleanProfileData.lastName ?? existing.lastName,
          thirdName: cleanProfileData.thirdName ?? existing.thirdName,
          fourthName: cleanProfileData.fourthName ?? existing.fourthName,
          firstNameAr: cleanProfileData.firstNameAr ?? existing.firstNameAr,
          lastNameAr: cleanProfileData.lastNameAr ?? existing.lastNameAr,
          thirdNameAr: cleanProfileData.thirdNameAr ?? existing.thirdNameAr,
          fourthNameAr: cleanProfileData.fourthNameAr ?? existing.fourthNameAr,
          department: cleanProfileData.department ?? existing.department,
          departmentAr: cleanProfileData.departmentAr ?? existing.departmentAr,
          jobTitle: cleanProfileData.jobTitle ?? existing.jobTitle,
          jobTitleAr: cleanProfileData.jobTitleAr ?? existing.jobTitleAr,
        });
        if (cleanProfileData.firstName || !existing.firstNameAr)
          cleanProfileData.firstNameAr = enrichedPatch.firstNameAr;
        if (cleanProfileData.lastName || !existing.lastNameAr)
          cleanProfileData.lastNameAr = enrichedPatch.lastNameAr;
        if (cleanProfileData.thirdName || !existing.thirdNameAr)
          cleanProfileData.thirdNameAr = enrichedPatch.thirdNameAr;
        if (cleanProfileData.fourthName || !existing.fourthNameAr)
          cleanProfileData.fourthNameAr = enrichedPatch.fourthNameAr;
        if (cleanProfileData.department || !existing.departmentAr)
          cleanProfileData.departmentAr = enrichedPatch.departmentAr;
        if (cleanProfileData.jobTitle || !existing.jobTitleAr)
          cleanProfileData.jobTitleAr = enrichedPatch.jobTitleAr;

        let updatedProfile = existing;
        if (Object.keys(cleanProfileData).length > 0) {
          const [updated] = await tenantDb
            .update(profilesTable)
            .set(cleanProfileData)
            .where(eq(profilesTable.id, params.data.id))
            .returning();
          if (updated) {
            updatedProfile = updated;
          }
        }

        if (idDocuments) {
          await tenantDb
            .delete(profileDocumentsTable)
            .where(eq(profileDocumentsTable.profileId, params.data.id));
          const validDocs = idDocuments
            .filter((doc: any) => doc && (doc.fileData || doc.fileName))
            .map((doc: any) => ({
              profileId: params.data.id,
              fileName: doc.fileName || "document",
              fileType: doc.fileType || "application/octet-stream",
              fileData: doc.fileData || "",
            }));
          if (validDocs.length > 0) {
            await tenantDb.insert(profileDocumentsTable).values(validDocs);
          }
        }

        // ── Hospitality Workflow: Auto-sync Room Status based on Profile Status ──
        if (parsed.data.status) {
          try {
            const newProfileStatus = parsed.data.status.toUpperCase();
            // Find active assignment for this profile
            const [activeAssign] = await tenantDb
              .select({
                id: assignmentsTable.id,
                roomId: assignmentsTable.roomId,
              })
              .from(assignmentsTable)
              .where(
                and(
                  eq(assignmentsTable.profileId, params.data.id),
                  eq(assignmentsTable.status, "ACTIVE"),
                ),
              );

            if (activeAssign && activeAssign.roomId) {
              const [room] = await tenantDb
                .select()
                .from(roomsTable)
                .where(eq(roomsTable.id, activeAssign.roomId));

              if (room) {
                if (newProfileStatus === "VACATION") {
                  // Check all active assignments in this room
                  const roomAssignments = await tenantDb
                    .select({
                      profileId: assignmentsTable.profileId,
                      status: profilesTable.status,
                    })
                    .from(assignmentsTable)
                    .leftJoin(
                      profilesTable,
                      eq(assignmentsTable.profileId, profilesTable.id),
                    )
                    .where(
                      and(
                        eq(assignmentsTable.roomId, room.id),
                        eq(assignmentsTable.status, "ACTIVE"),
                      ),
                    );

                  // If all occupants are in vacation (or this is the only occupant)
                  const allOnVacation = roomAssignments.every((ra) =>
                    ra.profileId === params.data.id
                      ? true
                      : ra.status?.toUpperCase() === "VACATION",
                  );

                  if (allOnVacation) {
                    await tenantDb
                      .update(roomsTable)
                      .set({ status: "occupied_vacation" })
                      .where(eq(roomsTable.id, room.id));
                  }
                } else if (newProfileStatus === "ACTIVE") {
                  // Returned from vacation -> set back to occupied
                  if (room.status === "occupied_vacation") {
                    await tenantDb
                      .update(roomsTable)
                      .set({ status: "occupied" })
                      .where(eq(roomsTable.id, room.id));
                  }
                } else if (newProfileStatus === "LEFT") {
                  // Profile marked as checked out -> checkout assignment & mark room dirty
                  await tenantDb
                    .update(assignmentsTable)
                    .set({
                      status: "CHECKED_OUT",
                      checkOutDate: new Date().toISOString().split("T")[0],
                    })
                    .where(eq(assignmentsTable.id, activeAssign.id));

                  const newOcc = Math.max(0, room.currentOccupancy - 1);
                  await tenantDb
                    .update(roomsTable)
                    .set({
                      currentOccupancy: newOcc,
                      status: newOcc === 0 ? "dirty" : "occupied_dirty",
                    })
                    .where(eq(roomsTable.id, room.id));
                }
              }
            }
          } catch (syncErr) {
            console.error(
              "[HospitalityWorkflow] Error syncing room status:",
              syncErr,
            );
          }
        }
        return { previous: existing, updated: updatedProfile };
      },
    );

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await moveOrEnsureProfilePortalAccount(
      propertyId,
      previous?.profileId,
      updated.profileId,
    );
    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تعديل بيانات الموظف: ${updated.firstName} ${updated.lastName}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: updated.id,
    });

    const safeUpdated = {
      ...updated,
      propertyId,
    };
    const updateParse = UpdateProfileResponse.safeParse(safeUpdated);
    res.json(updateParse.success ? updateParse.data : safeUpdated);
  },
);

router.delete(
  "/profiles/:id",
  requirePermission("profiles", "delete"),
  validate({ params: IdParams }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = DeleteProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const resolved = await resolveProfileTenant(params.data.id, propertyId);
    if (!resolved) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    propertyId = resolved.propertyId;

    const result = await withTenant(propertyId, async (tenantDb) => {
      // 1. Fetch employee
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, params.data.id));

      if (!emp) return { notFound: true };

      // 2. Prevent deleting profile if currently residing in a room
      const [activeAssignment] = await tenantDb
        .select({
          assignmentId: assignmentsTable.id,
          roomId: assignmentsTable.roomId,
          roomNumber: roomsTable.roomNumber,
          buildingName: buildingsTable.name,
        })
        .from(assignmentsTable)
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .where(
          and(
            eq(assignmentsTable.profileId, params.data.id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);

      if (activeAssignment || emp.status === "ASSIGNED") {
        const roomDesc = activeAssignment?.roomNumber
          ? `الغرفة ${activeAssignment.roomNumber}${activeAssignment.buildingName ? ` (مبنى ${activeAssignment.buildingName})` : ""}`
          : "غرفة سكنية نشطة";
        return {
          cannotDelete: true,
          roomNumber: activeAssignment?.roomNumber || null,
          messageAr: `لا يمكن حذف هذا الملف الشخصي لأن الموظف (${emp.firstName} ${emp.lastName}) مقيم حالياً في ${roomDesc}. يجب إجراء تسجيل مغادرة (Check-out) أولاً قبل حذف الملف الشخصي.`,
          messageEn: `Cannot delete profile (${emp.firstName} ${emp.lastName}) because they are currently residing in ${activeAssignment?.roomNumber ? `room ${activeAssignment.roomNumber}` : "a room"}. Please perform check-out first.`,
        };
      }

      // Safe to delete
      await tenantDb
        .delete(profilesTable)
        .where(eq(profilesTable.id, params.data.id));

      return { success: true, emp };
    });

    if (result.notFound) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (result.cannotDelete) {
      res.status(400).json({
        error: result.messageAr,
        errorEn: result.messageEn,
        roomNumber: result.roomNumber,
        code: "PROFILE_CURRENTLY_HOUSED",
      });
      return;
    }

    if (result.emp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف الموظف: ${result.emp.firstName} ${result.emp.lastName} (${result.emp.profileId})`,
        actionType: "DELETE",
        module: "profiles",
        entityType: "profile",
        entityId: result.emp.id,
        severity: "warning",
        details: `Dept: ${result.emp.department}`,
      });
      broadcastToProperty(propertyId, {
        module: "profiles",
        action: "deleted",
        entityId: result.emp.id,
      });
    }
    res.sendStatus(204);
  },
);

router.patch(
  "/profiles/:id/photo",
  requirePermission("profiles", "edit"),
  validate({ params: IdParams }),
  validate({ body: ProfilePhotoBody }),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    let propertyId = getTenantId(req);
    let profileExistsInTenant = false;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.id, id))
            .limit(1);
        });
        if (found) profileExistsInTenant = true;
      } catch {}
    }

    if (!profileExistsInTenant) {
      const authUser = (req as any).authUser;
      const isSysAdmin =
        authUser?.isSystemAdmin ||
        authUser?.roles?.some((r: any) =>
          ["super_admin", "system_admin"].includes(String(r).toLowerCase()),
        );
      const allowedPids: number[] = Array.isArray(authUser?.propertyIds)
        ? authUser.propertyIds.map(Number).filter(Boolean)
        : authUser?.propertyId
          ? [Number(authUser.propertyId)]
          : [];

      try {
        const props = await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          if (!isSysAdmin && !allowedPids.includes(p.id)) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select({ id: profilesTable.id })
                .from(profilesTable)
                .where(eq(profilesTable.id, id))
                .limit(1);
            });
            if (found) {
              propertyId = p.id;
              profileExistsInTenant = true;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profileExistsInTenant || !propertyId) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    let photoUrl: string | null;
    try {
      photoUrl = normalizePhotoData(
        (req.body as { photoUrl?: string })?.photoUrl,
      );
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid photo" });
      return;
    }

    const emp = await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(profilesTable)
        .set({ photoUrl: photoUrl ?? null })
        .where(eq(profilesTable.id, id));
      const [empData] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      return empData;
    });

    if (emp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث صورة الموظف: ${emp.firstName} ${emp.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: emp.id,
      });
    }
    res.json({ success: true });
  },
);

router.patch(
  "/profiles/:id/id-image",
  requirePermission("profiles", "edit"),
  validate({ params: IdParams }),
  validate({ body: ProfileIdImageBody }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const resolved = await resolveProfileTenant(id, propertyId);
    if (!resolved) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    propertyId = resolved.propertyId;

    let idImage: string | null;
    try {
      idImage = normalizePhotoData((req.body as { idImage?: string })?.idImage);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid ID image" });
      return;
    }

    const emp = await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(profilesTable)
        .set({ idImage: idImage ?? null })
        .where(eq(profilesTable.id, id));
      const [empData] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      return empData;
    });

    if (emp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث صورة بطاقة الموظف: ${emp.firstName} ${emp.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: emp.id,
      });
    }
    res.json({ success: true });
  },
);

export default router;
