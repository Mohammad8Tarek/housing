import { Router } from "express";
import {
  withTenant,
  activitiesTable,
  activityRegistrationsTable,
  employeesTable,
  portalNotificationsTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { broadcastToProperty } from "../lib/websocket.js";
import { requirePermission } from "../middlewares/permissions.js";
import { sanitizeFields } from "../lib/sanitize.js";
import { withTableFallback } from "../lib/with-table-fallback.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

const CreateActivitySchema = z.object({
  titleAr: z.string().min(1),
  titleEn: z.string().min(1),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  category: z.string().optional().default("general"),
  locationAr: z.string().optional(),
  locationEn: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  maxParticipants: z.number().optional(),
  status: z.string().optional().default("planned"),
  expiresAt: z.string().optional(),
  coverImage: z.string().optional(),
});

// @ts-ignore
router.get(
  "/activities",
  requirePermission("accommodation", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      try {
        const rows = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select()
            .from(activitiesTable)
            .orderBy(desc(activitiesTable.startDate));
        });

        return res.json(
          rows.map((r) => ({
            ...r,
            startDate: String(r.startDate),
            endDate: r.endDate ? String(r.endDate) : null,
            createdAt: String(r.createdAt),
          })),
        );
      } catch (dbErr: any) {
        const errMsg = (
          dbErr?.message ||
          dbErr?.cause?.message ||
          String(dbErr) ||
          ""
        ).toLowerCase();
        if (
          errMsg.includes("does not exist") ||
          errMsg.includes("relation") ||
          errMsg.includes("no table") ||
          errMsg.includes("42p01")
        ) {
          return res.json([]);
        }
        throw dbErr;
      }
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.post(
  "/activities",
  requirePermission("accommodation", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const parsed = CreateActivitySchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            success: false,
            message: parsed.error.errors[0]?.message ?? "Invalid input",
          });

      const sanitized = sanitizeFields(parsed.data, [
        "titleAr",
        "titleEn",
        "descriptionAr",
        "descriptionEn",
        "locationAr",
        "locationEn",
      ]);

      const insertData = { ...sanitized };
      if (insertData.expiresAt) {
        insertData.expiresAt = new Date(insertData.expiresAt) as any;
      } else {
        delete insertData.expiresAt;
      }

      const result = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const inserted = await tenantDb
              .insert(activitiesTable)
              .values(insertData as any)
              .returning();

            // إرسال إشعار تلقائي للجميع
            await tenantDb.insert(portalNotificationsTable).values({
              propertyId,
              title: "New Activity",
              titleAr: "فعالية جديدة",
              message: insertData.titleEn
                ? `A new activity has been announced: ${insertData.titleEn}`
                : "A new activity has been announced.",
              messageAr: insertData.titleAr
                ? `تم الإعلان عن فعالية جديدة: ${insertData.titleAr}`
                : "تم الإعلان عن فعالية جديدة.",
              type: "activity",
              priority: "high",
              targetAll: true,
            });

            return inserted;
          }),
        null,
      );

      if (!result) {
        return res
          .status(503)
          .json({
            success: false,
            message:
              "هذه الميزة غير متاحة بعد / This feature is not available yet",
          });
      }

      const [record] = result;
      broadcastToProperty(propertyId, {
        type: "data_updated",
        module: "notifications",
        action: "created",
      });

      return res.status(201).json({
        ...record,
        startDate: String(record.startDate),
        endDate: record.endDate ? String(record.endDate) : null,
        createdAt: String(record.createdAt),
      });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /api/activities/:id - Admin: update activity
const UpdateActivitySchema = z.object({
  titleAr: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  category: z.string().optional(),
  locationAr: z.string().optional(),
  locationEn: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  maxParticipants: z.number().optional(),
  status: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  coverImage: z.string().optional(),
});

// @ts-ignore
router.put(
  "/activities/:id",
  requirePermission("accommodation", "edit"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const id = Number(req.params.id);
      if (!propertyId || !id)
        return res
          .status(400)
          .json({ success: false, message: "propertyId and id required" });

      const parsed = UpdateActivitySchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            success: false,
            message: parsed.error.errors[0]?.message ?? "Invalid input",
          });

      const sanitized = sanitizeFields(parsed.data, [
        "titleAr",
        "titleEn",
        "descriptionAr",
        "descriptionEn",
        "locationAr",
        "locationEn",
      ]);

      const updateData: any = { ...sanitized };
      if (updateData.expiresAt === null) {
        updateData.expiresAt = null;
      } else if (updateData.expiresAt) {
        updateData.expiresAt = new Date(updateData.expiresAt);
      } else {
        delete updateData.expiresAt;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(activitiesTable)
          .set(updateData)
          .where(eq(activitiesTable.id, id))
          .returning();
      });

      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Activity not found" });

      return res.json({
        ...updated,
        startDate: String(updated.startDate),
        endDate: updated.endDate ? String(updated.endDate) : null,
        createdAt: String(updated.createdAt),
      });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/activities/:id/registrations - Admin: list registrations for an activity
// @ts-ignore
router.get(
  "/activities/:id/registrations",
  requirePermission("accommodation", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const activityId = Number(req.params.id);
      if (!propertyId || !activityId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId and id required" });

      const result = await withTenant(propertyId, async (tenantDb) => {
        const registrations = await tenantDb
          .select()
          .from(activityRegistrationsTable)
          .where(eq(activityRegistrationsTable.activityId, activityId))
          .orderBy(desc(activityRegistrationsTable.createdAt));

        const employeeIds = [
          ...new Set(registrations.map((r) => r.employeeId)),
        ];
        const employees =
          employeeIds.length > 0
            ? await tenantDb
                .select({
                  id: employeesTable.id,
                  firstName: employeesTable.firstName,
                  lastName: employeesTable.lastName,
                  employeeId: employeesTable.employeeId,
                  nationalId: employeesTable.nationalId,
                })
                .from(employeesTable)
                .where(inArray(employeesTable.id, employeeIds))
            : [];
        const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

        return registrations.map((r) => ({
          ...r,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : r.createdAt,
          attendedAt:
            r.attendedAt instanceof Date
              ? r.attendedAt.toISOString()
              : r.attendedAt,
          employeeName: empMap[r.employeeId]
            ? `${empMap[r.employeeId].firstName || ""} ${empMap[r.employeeId].lastName || ""}`.trim()
            : `Employee #${r.employeeId}`,
          employeeCode: empMap[r.employeeId]?.employeeId || null,
          nationalId: empMap[r.employeeId]?.nationalId || null,
        }));
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.delete(
  "/activities/:id",
  requirePermission("accommodation", "delete"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .delete(activitiesTable)
          .where(eq(activitiesTable.id, Number(req.params.id)));
      });

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
