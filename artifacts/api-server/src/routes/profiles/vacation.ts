import { Router } from "express";
import {
  withTenant,
  profilesTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logActivity } from "../../lib/activity-logger.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { resolveProfileTenant } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import {
  IdParams,
  VacationStartBody,
  VacationReturnBody,
} from "../../validation/schemas.js";

const router: Router = Router();

router.post(
  "/profiles/:id/vacation",
  requirePermission("profiles", "edit"),
  validate({ params: IdParams }),
  validate({ body: VacationStartBody }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const { startDate, endDate, notes } = req.body;
    if (!startDate || !endDate) {
      res.status(400).json({ error: "تاريخ البدء وتاريخ الانتهاء مطلوبان" });
      return;
    }

    const resolved = await resolveProfileTenant(id, propertyId);
    if (!resolved) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }
    propertyId = resolved.propertyId;

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      if (!emp) return null;

      // 1. Update profile
      const [updated] = await tenantDb
        .update(profilesTable)
        .set({
          status: "VACATION",
          vacationStartDate: startDate,
          vacationEndDate: endDate,
          vacationNotes: notes || "",
        })
        .where(eq(profilesTable.id, id))
        .returning();

      // 2. Insert vacation log
      await tenantDb.insert(profileVacationsTable).values({
        profileId: id,
        startDate,
        endDate,
        notes: notes || "",
        status: "ACTIVE",
      });

      // 3. Find active room assignment and update room to occupied_vacation
      const [activeAssign] = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      if (activeAssign?.roomId) {
        await tenantDb
          .update(roomsTable)
          .set({ status: "occupied_vacation" })
          .where(eq(roomsTable.id, activeAssign.roomId));
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل إجازة للموظف: ${result.firstName} ${result.lastName} (من ${startDate} إلى ${endDate})`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: result.id,
    });

    res.json({ success: true, profile: result });
  },
);

router.post(
  "/profiles/:id/return-vacation",
  requirePermission("profiles", "edit"),
  validate({ params: IdParams }),
  validate({ body: VacationReturnBody }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const resolved = await resolveProfileTenant(id, propertyId);
    if (!resolved) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }
    propertyId = resolved.propertyId;

    const returnDate =
      req.body.returnDate || new Date().toISOString().split("T")[0];

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      if (!emp) return null;

      // 1. Update profile back to ACTIVE
      const [updated] = await tenantDb
        .update(profilesTable)
        .set({
          status: "ACTIVE",
          vacationStartDate: null,
          vacationEndDate: null,
          vacationNotes: "",
        })
        .where(eq(profilesTable.id, id))
        .returning();

      // 2. Complete active vacation in history
      await tenantDb
        .update(profileVacationsTable)
        .set({
          actualReturnDate: returnDate,
          status: "COMPLETED",
        })
        .where(
          and(
            eq(profileVacationsTable.profileId, id),
            eq(profileVacationsTable.status, "ACTIVE"),
          ),
        );

      // 3. Update room back to occupied
      const [activeAssign] = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      if (activeAssign?.roomId) {
        await tenantDb
          .update(roomsTable)
          .set({ status: "occupied" })
          .where(eq(roomsTable.id, activeAssign.roomId));
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل عودة الموظف من الإجازة: ${result.firstName} ${result.lastName}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: result.id,
    });

    res.json({ success: true, profile: result });
  },
);

export default router;
