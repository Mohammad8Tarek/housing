import { Router } from "express";
import { withTenant, assignmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { UpdateAssignmentBody, UpdateAssignmentParams, UpdateAssignmentResponse } from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import { requirePermission, requireAnyPermission } from "../../middlewares/permissions.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { fmtAssignment, findPropertyByAssignmentId } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import { IdParams, BulkIdsBody } from "../../validation/schemas.js";

const router: Router = Router();

// ─── PATCH /assignments/:id ───────────────────────────────────────────────
router.patch(
  "/assignments/:id",
  requireAnyPermission(["accommodation", "edit"], ["accommodation", "create"]),
  validate({ params: IdParams }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = UpdateAssignmentParams.safeParse(req.params);
    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(params.data.id)) || 0;
    }

    let updated: any = null;
    if (propertyId) {
      try {
        [updated] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .update(assignmentsTable)
            .set(parsed.data as any)
            .where(eq(assignmentsTable.id, params.data.id))
            .returning();
        });
      } catch (err) {
        // Fall through
      }
    }

    if (!updated) {
      const autoPid = await findPropertyByAssignmentId(params.data.id);
      if (autoPid && autoPid !== propertyId) {
        propertyId = autoPid;
        [updated] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .update(assignmentsTable)
            .set(parsed.data as any)
            .where(eq(assignmentsTable.id, params.data.id))
            .returning();
        });
      }
    }

    if (!updated) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: parsed.data.expectedCheckOutDate
        ? `تمديد إقامة الموظف #${updated.profileId} حتى ${parsed.data.expectedCheckOutDate}`
        : `تحديث بيانات الإقامة #${updated.id}`,
      actionType: "UPDATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: updated.id,
    });

    broadcastToProperty(propertyId, {
      module: "accommodation",
      action: "updated",
      entityId: updated.id,
    });

    res.json(
      UpdateAssignmentResponse.parse({ ...fmtAssignment(updated), propertyId }),
    );
  },
);

// ─── DELETE /assignments/:id ──────────────────────────────────────────────────
router.delete(
  "/assignments/:id",
  requirePermission("accommodation", "delete"),
  validate({ params: IdParams }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const assignmentId = parseInt(String(req.params.id), 10);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignment ID" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(assignmentId)) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const [assignment] = await tenantDb
          .select()
          .from(assignmentsTable)
          .where(eq(assignmentsTable.id, assignmentId));

        if (!assignment) return { notFound: true };

        // Prevent deleting active assignments
        if (assignment.status === "ACTIVE") {
          return {
            isActive: true,
            error: "لا يمكن حذف إقامة نشطة حالياً. يجب تسجيل الخروج (Check-out) أولاً.",
          };
        }

        await tenantDb
          .delete(assignmentsTable)
          .where(eq(assignmentsTable.id, assignmentId));

        return { success: true, assignment };
      });

      if (result.notFound) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }

      if (result.isActive) {
        res.status(400).json({ error: result.error });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف سجل تسكين سابق #${assignmentId}`,
        actionType: "DELETE",
        module: "accommodation",
        entityType: "assignment",
        entityId: assignmentId,
        severity: "warning",
      });

      broadcastToProperty(propertyId, {
        module: "accommodation",
        action: "deleted",
        entityId: assignmentId,
      });

      res.json({ success: true, id: assignmentId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete assignment" });
    }
  },
);

// ─── POST /assignments/bulk-delete ────────────────────────────────────────────
router.post(
  "/assignments/bulk-delete",
  requirePermission("accommodation", "delete"),
  validate({ body: BulkIdsBody }),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array of assignment IDs" });
      return;
    }

    const numIds = ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    if (numIds.length === 0) {
      res.status(400).json({ error: "No valid assignment IDs provided" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(numIds[0])) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const idListSql = sql.join(numIds.map((id) => sql`${id}`), sql`, `);

        // Find which assignments are ACTIVE
        const activeRows = await tenantDb.execute(sql`
          SELECT id FROM assignments 
          WHERE id IN (${idListSql}) 
            AND status = 'ACTIVE'
        `);

        const activeIds = new Set<number>((activeRows.rows || []).map((r: any) => Number(r.id)));
        const deletableIds = numIds.filter((id) => !activeIds.has(id));

        if (deletableIds.length > 0) {
          const deletableSql = sql.join(deletableIds.map((id) => sql`${id}`), sql`, `);
          await tenantDb
            .delete(assignmentsTable)
            .where(sql`${assignmentsTable.id} IN (${deletableSql})`);
        }

        return {
          deletedCount: deletableIds.length,
          skippedCount: activeIds.size,
        };
      });

      const s = su(req);
      if (result.deletedCount > 0) {
        await logActivity({
          req,
          propertyId,
          username: s.username,
          userId: s.userId,
          userRole: s.userRole,
          action: `حذف جماعي لـ ${result.deletedCount} سجل من تاريخ التسكين`,
          actionType: "DELETE",
          module: "accommodation",
          entityType: "assignment",
          severity: "warning",
        });

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "deleted",
          data: { count: result.deletedCount },
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to bulk delete assignments" });
    }
  },
);

export default router;
