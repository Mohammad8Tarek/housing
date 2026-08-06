import { Router } from "express";
import {
  db,
  withTenant,
  hostingsTable,
  hostingCompanionsTable,
  employeesTable,
  roomsTable,
  buildingsTable,
  floorsTable,
} from "@workspace/db";
import { eq, and, inArray, SQL } from "drizzle-orm";
import {
  CreateHostingBody,
  UpdateHostingBody,
  UpdateHostingParams,
  DeleteHostingParams,
  ApproveHostingParams,
  CheckinHostingParams,
  CheckinHostingBody,
  CheckoutHostingParams,
  ListHostingsQueryParams,
  ListHostingsResponse,
  UpdateHostingResponse,
  ApproveHostingResponse,
  CheckinHostingResponse,
  CheckoutHostingResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();
const MAX_DOCUMENT_IMAGE_LENGTH = 7 * 1024 * 1024;
const DOCUMENT_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const DOCUMENT_WEB_URL_RE = /^https?:\/\/[^\s]+$/i;
const DOCUMENT_TYPES = new Set(["ID", "PASSPORT", "OTHER"]);

function fmtHosting(r: Record<string, any>) {
  const dateFields = [
    "expectedFrom",
    "expectedTo",
    "actualCheckIn",
    "actualCheckOut",
    "createdAt",
    "updatedAt",
  ];
  const out: Record<string, any> = { ...r };
  for (const f of dateFields) {
    if (out[f] instanceof Date && typeof out[f].toISOString === "function")
      out[f] = out[f].toISOString();
    else if (out[f] == null) out[f] = null;
  }
  return out;
}

function fmtCompanion(c: Record<string, any>) {
  const out: Record<string, any> = { ...c };
  const dateFields = ["createdAt", "updatedAt"];
  for (const f of dateFields) {
    if (out[f] instanceof Date && typeof out[f].toISOString === "function")
      out[f] = out[f].toISOString();
    else if (out[f] == null) out[f] = null;
  }
  out.documentImage = safeDocumentImage(out.documentImage);
  return out;
}

function safeDocumentImage(value: unknown) {
  if (value == null || value === "") return null;
  const image = String(value);
  if (image.length > MAX_DOCUMENT_IMAGE_LENGTH) return null;
  if (DOCUMENT_DATA_IMAGE_RE.test(image) || DOCUMENT_WEB_URL_RE.test(image))
    return image;
  return null;
}

function normalizeDocumentImage(value: unknown) {
  if (value == null || value === "") return null;
  const image = String(value);
  if (image.length > MAX_DOCUMENT_IMAGE_LENGTH) {
    throw new Error("Document image exceeds the 5 MB upload limit");
  }
  if (!DOCUMENT_DATA_IMAGE_RE.test(image) && !DOCUMENT_WEB_URL_RE.test(image)) {
    throw new Error("Document image must be a PNG, JPG, WEBP, or GIF image");
  }
  return image;
}

function normalizeDocumentFileName(value: unknown) {
  if (value == null || value === "") return null;
  return (
    String(value)
      .replace(/[^\w.\- ()]/g, "")
      .slice(0, 160)
      .trim() || null
  );
}

function normalizeCompanionInput(c: Record<string, any>) {
  const name = String(c.name ?? "").trim();
  if (!name) throw new Error("Companion name is required");
  const documentType = c.documentType
    ? String(c.documentType).toUpperCase()
    : null;
  const isChild = Number(c.isChild) === 1 ? 1 : 0;
  return {
    name,
    idNumber: c.idNumber ? String(c.idNumber).trim().slice(0, 80) : null,
    documentType:
      documentType && DOCUMENT_TYPES.has(documentType) ? documentType : null,
    documentImage: normalizeDocumentImage(c.documentImage),
    documentFileName: normalizeDocumentFileName(c.documentFileName),
    relation: c.relation ? String(c.relation).trim().slice(0, 80) : null,
    isChild,
    age:
      isChild && c.age != null && c.age !== ""
        ? Math.max(0, Math.min(17, Number(c.age) || 0))
        : null,
  };
}

function fmtRelated(r: Record<string, any> | null | undefined) {
  if (!r) return null;
  const out: Record<string, any> = { ...r };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date && typeof value.toISOString === "function") {
      out[key] = value.toISOString();
    }
  }
  return out;
}

async function fetchCompanions(tenantDb: any, hostingId: number) {
  const rows = await tenantDb
    .select()
    .from(hostingCompanionsTable)
    .where(eq(hostingCompanionsTable.hostingId, hostingId));
  return rows.map(fmtCompanion);
}

router.get(
  "/hostings",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const query = ListHostingsQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      if (query.success) {
        if (query.data.status)
          conditions.push(eq(hostingsTable.status, query.data.status));
      }

      const { hostings, companions } = await withTenant(
        propertyId,
        async (tenantDb) => {
          const hostingsQuery = tenantDb
            .select({
              hosting: hostingsTable,
              employee: employeesTable,
              room: roomsTable,
              building: buildingsTable,
              floor: floorsTable,
            })
            .from(hostingsTable)
            .leftJoin(
              employeesTable,
              eq(hostingsTable.employeeId, employeesTable.id),
            )
            .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
            .leftJoin(
              buildingsTable,
              eq(roomsTable.buildingId, buildingsTable.id),
            )
            .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id));

          const rows =
            conditions.length > 0
              ? await hostingsQuery.where(and(...conditions))
              : await hostingsQuery;

          const hostingIds = rows.map((r) => r.hosting.id);
          const companionsList =
            hostingIds.length > 0
              ? await tenantDb
                  .select()
                  .from(hostingCompanionsTable)
                  .where(inArray(hostingCompanionsTable.hostingId, hostingIds))
              : [];

          return { hostings: rows, companions: companionsList };
        },
      );

      const companionsByHosting = new Map<number, any[]>();
      companions.forEach((c) => {
        const list = companionsByHosting.get(c.hostingId) ?? [];
        list.push(fmtCompanion(c));
        companionsByHosting.set(c.hostingId, list);
      });

      const enriched = hostings.map(
        ({ hosting, employee, room, building, floor }) => {
          const comps = companionsByHosting.get(hosting.id) ?? [];
          const base = fmtHosting({
            ...hosting,
            propertyId,
            companions: comps,
          });
          const parsedBase = ListHostingsResponse.parse([base])[0];

          return {
            ...parsedBase,
            companions: comps,
            employee: employee ? fmtRelated(employee) : null,
            room: room
              ? {
                  ...fmtRelated(room),
                  buildingName: building?.name ?? null,
                  buildingLocation: building?.location ?? null,
                  floorNumber: floor?.floorNumber ?? null,
                  floorDescription: floor?.description ?? null,
                }
              : null,
          };
        },
      );

      res.json(enriched);
    } catch (error: any) {
      console.error(
        "[Hostings API] Error fetching hostings:",
        error.message || error,
      );
      res.status(500).json({ error: "Failed to fetch hostings" });
    }
  },
);

router.post(
  "/hostings",
  requirePermission("accommodation", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateHostingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data as any;
    let companions: ReturnType<typeof normalizeCompanionInput>[] | undefined;
    try {
      companions = Array.isArray((req.body as any).companions)
        ? ((req.body as any).companions as Record<string, any>[]).map(
            normalizeCompanionInput,
          )
        : undefined;
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Invalid companion data" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      if (data.roomId) {
        const [room] = await tenantDb
          .select({
            currentOccupancy: roomsTable.currentOccupancy,
            capacity: roomsTable.capacity,
          })
          .from(roomsTable)
          .where(eq(roomsTable.id, data.roomId))
          .limit(1);
        if (room && room.currentOccupancy >= room.capacity) {
          return { conflict: true, customError: "Cannot create hosting: Room is fully occupied." } as const;
        }
      }

      const [hosting] = await tenantDb
        .insert(hostingsTable)
        .values({
          ...data,
          notes: data.notes ?? "",
          status: "PENDING",
        })
        .returning();

      if (companions && companions.length > 0) {
        await tenantDb.insert(hostingCompanionsTable).values(
          companions.map((c) => ({
            hostingId: hosting.id,
            ...c,
          })),
        );
      }
      const companionsList = await tenantDb
        .select()
        .from(hostingCompanionsTable)
        .where(eq(hostingCompanionsTable.hostingId, hosting.id));
      return { data: { hosting, companionsList } } as const;
    });

    if ("conflict" in result) {
      res.status(409).json({ error: result.customError });
      return;
    }

    const resData = result.data;

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `طلب استضافة جديد للموظف #${resData.hosting.employeeId}`,
      actionType: "CREATE",
      module: "accommodation",
      entityType: "hosting",
      entityId: resData.hosting.id,
      details: `Guests: ${resData.hosting.guestsCount}`,
    });
    res.status(201).json({
      ...fmtHosting(resData.hosting),
      propertyId,
      companions: resData.companionsList.map(fmtCompanion),
    });
  },
);

// GET /hostings/:id — Fetch single hosting with employee, room, building, floor
router.get(
  "/hostings/:id",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const hostingId = parseInt(req.params.id as string);
    if (isNaN(hostingId)) {
      res.status(400).json({ error: "Invalid hosting ID" });
      return;
    }

    try {
      const { hostings, companions } = await withTenant(
        propertyId,
        async (tenantDb) => {
          const rows = await tenantDb
            .select({
              hosting: hostingsTable,
              employee: employeesTable,
              room: roomsTable,
              building: buildingsTable,
              floor: floorsTable,
            })
            .from(hostingsTable)
            .leftJoin(
              employeesTable,
              eq(hostingsTable.employeeId, employeesTable.id),
            )
            .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
            .leftJoin(
              buildingsTable,
              eq(roomsTable.buildingId, buildingsTable.id),
            )
            .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
            .where(eq(hostingsTable.id, hostingId))
            .limit(1);

          if (rows.length === 0) return { hostings: [], companions: [] };

          const companionsList = await tenantDb
            .select()
            .from(hostingCompanionsTable)
            .where(eq(hostingCompanionsTable.hostingId, hostingId));

          return { hostings: rows, companions: companionsList };
        },
      );

      if (hostings.length === 0) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const { hosting, employee, room, building, floor } = hostings[0];
      const base = fmtHosting({
        ...hosting,
        propertyId,
        companions: companions.map(fmtCompanion),
      });

      res.json({
        success: true,
        data: {
          ...base,
          companions: companions.map(fmtCompanion),
          employee: employee ? fmtRelated(employee) : null,
          room: room
            ? {
                ...fmtRelated(room),
                buildingName: building?.name ?? null,
                buildingLocation: building?.location ?? null,
                floorNumber: floor?.floorNumber ?? null,
                floorDescription: floor?.description ?? null,
              }
            : null,
        },
      });
    } catch (error: any) {
      console.error(
        "[Hostings API] Error fetching hosting:",
        error.message || error,
      );
      res.status(500).json({ error: "Failed to fetch hosting" });
    }
  },
);

router.patch(
  "/hostings/:id",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const params = UpdateHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const parsed = UpdateHostingBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        if (parsed.data.roomId) {
          const [room] = await tenantDb
            .select({
              currentOccupancy: roomsTable.currentOccupancy,
              capacity: roomsTable.capacity,
            })
            .from(roomsTable)
            .where(eq(roomsTable.id, parsed.data.roomId))
            .limit(1);
          if (room && room.currentOccupancy >= room.capacity) {
            return { conflict: true, customError: "Cannot update hosting: Room is fully occupied." } as const;
          }
        }

        const [updated] = await tenantDb
          .update(hostingsTable)
          .set(parsed.data as any)
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
        return { updated } as const;
      });

      if ("conflict" in result) {
        res.status(409).json({ error: result.customError });
        return;
      }

      const updated = result.updated;
      if (!updated) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const updatedCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تعديل طلب استضافة #${updated.id}`,
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const response = {
        ...fmtHosting(updated),
        companions: updatedCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Update Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to update hosting" });
    }
  },
);

router.delete(
  "/hostings/:id",
  requirePermission("accommodation", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteHostingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingH = await withTenant(propertyId, async (tenantDb) => {
      const [h] = await tenantDb
        .select()
        .from(hostingsTable)
        .where(eq(hostingsTable.id, params.data.id));
      if (h)
        await tenantDb
          .delete(hostingsTable)
          .where(eq(hostingsTable.id, params.data.id));
      return h;
    });

    if (existingH) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف طلب استضافة #${existingH.id}`,
        actionType: "DELETE",
        module: "accommodation",
        entityType: "hosting",
        entityId: existingH.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

router.post(
  "/hostings/:id/approve",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const params = ApproveHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const current = await tenantDb
          .select({ status: hostingsTable.status })
          .from(hostingsTable)
          .where(eq(hostingsTable.id, params.data.id))
          .limit(1);

        if (!current.length) return { notFound: true } as const;
        if (current[0].status !== "PENDING") {
          return { conflict: true, status: current[0].status } as const;
        }

        const rows = await tenantDb
          .update(hostingsTable)
          .set({ status: "APPROVED" })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
        return { data: rows[0] } as const;
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }
      if ("conflict" in result) {
        res.status(409).json({
          error: `Cannot approve: hosting is "${result.status}", expected "PENDING"`,
        });
        return;
      }

      const updated = result.data;

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `الموافقة على طلب الاستضافة #${updated.id}`,
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const approveCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: approveCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Approve Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to approve hosting" });
    }
  },
);

router.post(
  "/hostings/:id/checkin",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const params = CheckinHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const parsed = CheckinHostingBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const current = await tenantDb
          .select({ status: hostingsTable.status, roomId: hostingsTable.roomId })
          .from(hostingsTable)
          .where(eq(hostingsTable.id, params.data.id))
          .limit(1);

        if (!current.length) return { notFound: true } as const;
        if (current[0].status !== "APPROVED") {
          return { conflict: true, status: current[0].status } as const;
        }

        const roomIdToUse = parsed.data.roomId ?? current[0].roomId;
        if (roomIdToUse) {
          const [room] = await tenantDb
            .select({
              currentOccupancy: roomsTable.currentOccupancy,
              capacity: roomsTable.capacity,
            })
            .from(roomsTable)
            .where(eq(roomsTable.id, roomIdToUse))
            .limit(1);
          
          if (room && room.currentOccupancy >= room.capacity) {
            return { conflict: true, customError: "Cannot check in: Room is fully occupied." } as const;
          }
        }

        const rows = await tenantDb
          .update(hostingsTable)
          .set({
            actualCheckIn: parsed.data.actualCheckIn,
            ...(parsed.data.roomId !== undefined
              ? { roomId: parsed.data.roomId }
              : {}),
            status: "ACTIVE",
          })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();

        // Update room occupancy
        if (roomIdToUse) {
          const [room] = await tenantDb
            .select({
              currentOccupancy: roomsTable.currentOccupancy,
              capacity: roomsTable.capacity,
            })
            .from(roomsTable)
            .where(eq(roomsTable.id, roomIdToUse))
            .limit(1);
          if (room) {
            const newOcc = room.currentOccupancy + 1;
            await tenantDb
              .update(roomsTable)
              .set({
                currentOccupancy: newOcc,
                status: newOcc >= room.capacity ? "occupied" : "available",
              })
              .where(eq(roomsTable.id, roomIdToUse));
          }
        }

        return { data: rows[0] } as const;
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }
      if ("conflict" in result) {
        if ("customError" in result) {
          res.status(409).json({ error: result.customError });
        } else {
          res.status(409).json({
            error: `Cannot check in: hosting is "${result.status}", expected "APPROVED"`,
          });
        }
        return;
      }


      const updated = result.data;

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `وصول الضيوف للموظف #${updated.employeeId}`,
        actionType: "CHECKIN",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const checkinCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: checkinCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Checkin Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to checkin hosting" });
    }
  },
);

router.post(
  "/hostings/:id/checkout",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const params = CheckoutHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const current = await tenantDb
          .select({ status: hostingsTable.status })
          .from(hostingsTable)
          .where(eq(hostingsTable.id, params.data.id))
          .limit(1);

        if (!current.length) return { notFound: true } as const;
        if (current[0].status !== "ACTIVE") {
          return { conflict: true, status: current[0].status } as const;
        }

        const rows = await tenantDb
          .update(hostingsTable)
          .set({
            actualCheckOut: new Date().toISOString().split("T")[0],
            status: "COMPLETED",
          })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();

        // Decrement room occupancy
        if (rows[0]?.roomId) {
          const [room] = await tenantDb
            .select({ currentOccupancy: roomsTable.currentOccupancy })
            .from(roomsTable)
            .where(eq(roomsTable.id, rows[0].roomId))
            .limit(1);
          if (room) {
            const newOcc = Math.max(0, room.currentOccupancy - 1);
            await tenantDb
              .update(roomsTable)
              .set({
                currentOccupancy: newOcc,
                status: newOcc === 0 ? "available" : "occupied",
              })
              .where(eq(roomsTable.id, rows[0].roomId));
          }
        }

        return { data: rows[0] } as const;
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }
      if ("conflict" in result) {
        res.status(409).json({
          error: `Cannot check out: hosting is "${result.status}", expected "ACTIVE"`,
        });
        return;
      }

      const updated = result.data;

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تسجيل مغادرة ضيوف للموظف #${updated.employeeId}`,
        actionType: "CHECKOUT",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const checkoutCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: checkoutCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Checkout API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to checkout hosting" });
    }
  },
);

/* Companions CRUD */
router.get(
  "/hostings/:id/companions",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const companions = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(hostingCompanionsTable)
        .where(eq(hostingCompanionsTable.hostingId, id));
    });

    res.json(companions.map(fmtCompanion));
  },
);

router.post(
  "/hostings/:id/companions",
  requirePermission("accommodation", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    let body: ReturnType<typeof normalizeCompanionInput>;
    try {
      body = normalizeCompanionInput(req.body as Record<string, any>);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Invalid companion data" });
      return;
    }

    const [companion] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(hostingCompanionsTable)
        .values({
          hostingId: id,
          ...body,
        })
        .returning();
    });

    res.status(201).json(fmtCompanion(companion));
  },
);

router.delete(
  "/hostings/:id/companions/:companionId",
  requirePermission("accommodation", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const hostingId = parseInt(req.params.id as string);
    if (isNaN(hostingId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const companionId = parseInt(req.params.companionId as string);
    if (isNaN(companionId)) {
      res.status(400).json({ error: "Invalid companion id" });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(hostingCompanionsTable)
        .where(
          and(
            eq(hostingCompanionsTable.id, companionId),
            eq(hostingCompanionsTable.hostingId, hostingId),
          ),
        );
    });

    res.sendStatus(204);
  },
);

export default router;
