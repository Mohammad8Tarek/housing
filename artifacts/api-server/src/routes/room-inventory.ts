import { Router, type Request, type Response, type NextFunction } from "express";
import {
  withTenant,
  roomInventoryTable,
  roomsTable,
  buildingsTable,
  floorsTable,
  maintenanceTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, count, sql, SQL } from "drizzle-orm";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { withTableFallback } from "../lib/with-table-fallback.js";

const router: Router = Router();

// Helper to categorize standard room amenities
export function categorizeAmenity(name: string): string {
  const n = name.trim().toLowerCase();
  if (
    n.includes("tv") ||
    n.includes("television") ||
    n.includes("screen") ||
    n.includes("satellite") ||
    n.includes("wifi") ||
    n.includes("router")
  ) {
    return "electronics";
  }
  if (
    n.includes("air condition") ||
    n.includes("ac") ||
    n.includes("fridge") ||
    n.includes("refrigerator") ||
    n.includes("washing") ||
    n.includes("iron") ||
    n.includes("kettle") ||
    n.includes("microwave") ||
    n.includes("heater") ||
    n.includes("dryer")
  ) {
    return "appliances";
  }
  if (
    n.includes("wardrobe") ||
    n.includes("desk") ||
    n.includes("chair") ||
    n.includes("bed") ||
    n.includes("sofa") ||
    n.includes("seating") ||
    n.includes("table") ||
    n.includes("closet")
  ) {
    return "furniture";
  }
  if (
    n.includes("safe") ||
    n.includes("mirror") ||
    n.includes("curtain") ||
    n.includes("balcony") ||
    n.includes("bathroom") ||
    n.includes("kitchenette") ||
    n.includes("lamp")
  ) {
    return "fixtures";
  }
  if (
    n.includes("linen") ||
    n.includes("bedding") ||
    n.includes("pillow") ||
    n.includes("blanket") ||
    n.includes("towel")
  ) {
    return "linen";
  }
  return "other";
}

// ─── GET /api/room-inventory ──────────────────────────────────────────────
router.get(
  "/",
  requireAnyPermission(["housing", "view"], ["reports", "view"]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "propertyId required" });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const offset = (page - 1) * limit;

      const roomId = req.query.roomId ? parseInt(req.query.roomId as string, 10) : undefined;
      const buildingId = req.query.buildingId ? parseInt(req.query.buildingId as string, 10) : undefined;
      const floorId = req.query.floorId ? parseInt(req.query.floorId as string, 10) : undefined;
      const category = (req.query.category as string)?.trim();
      const condition = (req.query.condition as string)?.trim();
      const search = (req.query.search as string)?.trim();

      const result = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const conditions: SQL[] = [];

            if (roomId && !isNaN(roomId)) {
              conditions.push(eq(roomInventoryTable.roomId, roomId));
            }
            if (buildingId && !isNaN(buildingId)) {
              conditions.push(eq(roomsTable.buildingId, buildingId));
            }
            if (floorId && !isNaN(floorId)) {
              conditions.push(eq(roomsTable.floorId, floorId));
            }
            if (category && category !== "all") {
              conditions.push(eq(roomInventoryTable.category, category.toLowerCase()));
            }
            if (condition && condition !== "all") {
              conditions.push(eq(roomInventoryTable.condition, condition.toLowerCase()));
            }
            if (search) {
              conditions.push(
                or(
                  ilike(roomInventoryTable.itemName, `%${search}%`),
                  ilike(roomInventoryTable.serialNumber, `%${search}%`),
                  ilike(roomInventoryTable.barcode, `%${search}%`),
                  ilike(roomInventoryTable.modelNumber, `%${search}%`),
                  ilike(roomsTable.roomNumber, `%${search}%`),
                  ilike(buildingsTable.name, `%${search}%`)
                )!
              );
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(roomInventoryTable)
              .innerJoin(roomsTable, eq(roomInventoryTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .where(whereClause);

            const totalCount = Number(countRes?.count || 0);

            const rows = await tenantDb
              .select({
                id: roomInventoryTable.id,
                roomId: roomInventoryTable.roomId,
                itemName: roomInventoryTable.itemName,
                category: roomInventoryTable.category,
                quantity: roomInventoryTable.quantity,
                condition: roomInventoryTable.condition,
                barcode: roomInventoryTable.barcode,
                serialNumber: roomInventoryTable.serialNumber,
                modelNumber: roomInventoryTable.modelNumber,
                lastInspectedAt: roomInventoryTable.lastInspectedAt,
                inspectedBy: roomInventoryTable.inspectedBy,
                notes: roomInventoryTable.notes,
                createdAt: roomInventoryTable.createdAt,
                updatedAt: roomInventoryTable.updatedAt,
                roomNumber: roomsTable.roomNumber,
                roomType: roomsTable.roomType,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorName: floorsTable.floorNumber,
              })
              .from(roomInventoryTable)
              .innerJoin(roomsTable, eq(roomInventoryTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(roomInventoryTable.id));

            return {
              data: rows,
              pagination: {
                total: totalCount,
                page,
                limit,
              },
            };
          }),
        { data: [], pagination: { total: 0, page, limit } }
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/room-inventory/summary ─────────────────────────────────────
router.get(
  "/summary",
  requireAnyPermission(["housing", "view"], ["reports", "view"]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "propertyId required" });
        return;
      }

      const { buildingId, floorId, category, search } = req.query;

      const summary = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const rows = await tenantDb
              .select({
                id: roomInventoryTable.id,
                roomId: roomInventoryTable.roomId,
                itemName: roomInventoryTable.itemName,
                category: roomInventoryTable.category,
                quantity: roomInventoryTable.quantity,
                condition: roomInventoryTable.condition,
                serialNumber: roomInventoryTable.serialNumber,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
              })
              .from(roomInventoryTable)
              .leftJoin(roomsTable, eq(roomInventoryTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id));

            const map = new Map<string, any>();

            for (const r of rows) {
              if (buildingId && buildingId !== "all" && String(r.buildingId) !== String(buildingId)) continue;
              if (floorId && floorId !== "all" && String(r.floorId) !== String(floorId)) continue;
              if (category && category !== "all" && r.category?.toLowerCase() !== String(category).toLowerCase()) continue;

              const key = `${r.itemName.trim().toLowerCase()}:::${r.category?.toLowerCase() || "other"}`;
              if (!map.has(key)) {
                map.set(key, {
                  id: key,
                  itemName: r.itemName.trim(),
                  category: r.category || "other",
                  totalQuantity: 0,
                  goodCount: 0,
                  needsRepairCount: 0,
                  damagedCount: 0,
                  missingCount: 0,
                  roomsSet: new Set<number>(),
                  roomsList: [],
                });
              }

              const entry = map.get(key);
              const qty = Number(r.quantity) || 1;
              entry.totalQuantity += qty;

              const cond = (r.condition || "good").toLowerCase();
              if (cond === "good" || cond === "fair") {
                entry.goodCount += qty;
              } else if (cond === "needs_repair") {
                entry.needsRepairCount += qty;
              } else if (cond === "damaged") {
                entry.damagedCount += qty;
              } else if (cond === "missing") {
                entry.missingCount += qty;
              } else {
                entry.goodCount += qty;
              }

              if (r.roomId) {
                entry.roomsSet.add(r.roomId);
                entry.roomsList.push({
                  roomId: r.roomId,
                  roomNumber: r.roomNumber || `#${r.roomId}`,
                  buildingName: r.buildingName || "—",
                  floorNumber: r.floorNumber ? `Floor ${r.floorNumber}` : "—",
                  quantity: qty,
                  condition: r.condition || "good",
                  serialNumber: r.serialNumber || "",
                });
              }
            }

            let result = Array.from(map.values()).map((item) => ({
              id: item.id,
              itemName: item.itemName,
              category: item.category,
              totalQuantity: item.totalQuantity,
              goodCount: item.goodCount,
              needsRepairCount: item.needsRepairCount,
              damagedCount: item.damagedCount,
              missingCount: item.missingCount,
              roomsCount: item.roomsSet.size,
              roomsList: item.roomsList,
            }));

            if (search && String(search).trim()) {
              const q = String(search).trim().toLowerCase();
              result = result.filter(
                (item) =>
                  item.itemName.toLowerCase().includes(q) ||
                  item.category.toLowerCase().includes(q) ||
                  item.roomsList.some((rm: any) => String(rm.roomNumber).toLowerCase().includes(q))
              );
            }

            result.sort((a, b) => b.totalQuantity - a.totalQuantity);
            return result;
          }),
        []
      );

      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/room-inventory/room/:roomId ─────────────────────────────────
router.get(
  "/room/:roomId",
  requireAnyPermission(["housing", "view"], ["reports", "view"]),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const roomId = parseInt(String(req.params.roomId), 10);
      if (!propertyId || isNaN(roomId)) {
        res.status(400).json({ success: false, message: "Valid propertyId and roomId required" });
        return;
      }

      const items = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            return await tenantDb
              .select()
              .from(roomInventoryTable)
              .where(eq(roomInventoryTable.roomId, roomId))
              .orderBy(desc(roomInventoryTable.id));
          }),
        []
      );

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/room-inventory ─────────────────────────────────────────────
router.post(
  "/",
  requirePermission("housing", "edit"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "propertyId required" });
        return;
      }

      const {
        roomId,
        itemName,
        category,
        quantity,
        condition,
        barcode,
        serialNumber,
        modelNumber,
        notes,
        inspectedBy,
        lastInspectedAt,
      } = req.body;

      if (!roomId || !itemName?.trim()) {
        res.status(400).json({ success: false, message: "roomId and itemName are required" });
        return;
      }

      const newItem = await withTenant(propertyId, async (tenantDb) => {
        const cat = category?.trim() || categorizeAmenity(itemName);
        const [inserted] = await tenantDb
          .insert(roomInventoryTable)
          .values({
            roomId: Number(roomId),
            itemName: itemName.trim(),
            category: cat,
            quantity: Number(quantity) > 0 ? Number(quantity) : 1,
            condition: condition?.trim() || "good",
            barcode: barcode?.trim() || null,
            serialNumber: serialNumber?.trim() || null,
            modelNumber: modelNumber?.trim() || null,
            notes: notes?.trim() || null,
            inspectedBy: inspectedBy?.trim() || null,
            lastInspectedAt: lastInspectedAt ? new Date(lastInspectedAt) : null,
          })
          .returning();
        return inserted;
      });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `إضافة عهدة/معدة للغرفة: ${itemName}`,
        actionType: "CREATE",
        module: "housing",
      });

      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "created",
        entityId: newItem.id,
        data: { item: newItem },
      });

      res.status(201).json({ success: true, data: newItem });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/room-inventory/:id ──────────────────────────────────────────
router.put(
  "/:id",
  requirePermission("housing", "edit"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const itemId = parseInt(String(req.params.id), 10);
      if (!propertyId || isNaN(itemId)) {
        res.status(400).json({ success: false, message: "Valid propertyId and itemId required" });
        return;
      }

      const {
        itemName,
        category,
        quantity,
        condition,
        barcode,
        serialNumber,
        modelNumber,
        notes,
        inspectedBy,
        lastInspectedAt,
      } = req.body;

      const updatedItem = await withTenant(propertyId, async (tenantDb) => {
        const updateValues: Record<string, any> = {
          updatedAt: new Date(),
        };

        if (itemName !== undefined) updateValues.itemName = itemName.trim();
        if (category !== undefined) updateValues.category = category.trim();
        if (quantity !== undefined) updateValues.quantity = Math.max(1, Number(quantity));
        if (condition !== undefined) updateValues.condition = condition.trim();
        if (barcode !== undefined) updateValues.barcode = barcode?.trim() || null;
        if (serialNumber !== undefined) updateValues.serialNumber = serialNumber?.trim() || null;
        if (modelNumber !== undefined) updateValues.modelNumber = modelNumber?.trim() || null;
        if (notes !== undefined) updateValues.notes = notes?.trim() || null;
        if (inspectedBy !== undefined) updateValues.inspectedBy = inspectedBy?.trim() || null;
        if (lastInspectedAt !== undefined) {
          updateValues.lastInspectedAt = lastInspectedAt ? new Date(lastInspectedAt) : null;
        }

        const [updated] = await tenantDb
          .update(roomInventoryTable)
          .set(updateValues)
          .where(eq(roomInventoryTable.id, itemId))
          .returning();
        return updated;
      });

      if (!updatedItem) {
        res.status(404).json({ success: false, message: "Inventory item not found" });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث عهدة/معدة رقم ${itemId}: ${updatedItem.itemName}`,
        actionType: "UPDATE",
        module: "housing",
      });

      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "updated",
        entityId: itemId,
        data: { item: updatedItem },
      });

      res.json({ success: true, data: updatedItem });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/room-inventory/:id ───────────────────────────────────────
router.delete(
  "/:id",
  requirePermission("housing", "edit"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const itemId = parseInt(String(req.params.id), 10);
      if (!propertyId || isNaN(itemId)) {
        res.status(400).json({ success: false, message: "Valid propertyId and itemId required" });
        return;
      }

      const deleted = await withTenant(propertyId, async (tenantDb) => {
        const [del] = await tenantDb
          .delete(roomInventoryTable)
          .where(eq(roomInventoryTable.id, itemId))
          .returning();
        return del;
      });

      if (!deleted) {
        res.status(404).json({ success: false, message: "Inventory item not found" });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف عهدة/معدة: ${deleted.itemName} من الغرفة`,
        actionType: "DELETE",
        module: "housing",
      });

      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "deleted",
        entityId: itemId,
      });

      res.json({ success: true, message: "Inventory item deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/room-inventory/sync-from-features ──────────────────────────
// Syncs amenities list from roomsTable into roomInventoryTable idempotently
router.post(
  "/sync-from-features",
  requirePermission("housing", "edit"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "propertyId required" });
        return;
      }

      const roomId = req.body.roomId ? parseInt(String(req.body.roomId), 10) : undefined;
      const buildingId = req.body.buildingId ? parseInt(String(req.body.buildingId), 10) : undefined;

      const syncResult = await withTenant(propertyId, async (tenantDb) => {
        let roomsQuery = tenantDb.select().from(roomsTable);
        const whereClauses: SQL[] = [];
        if (roomId && !isNaN(roomId)) {
          whereClauses.push(eq(roomsTable.id, roomId));
        }
        if (buildingId && !isNaN(buildingId)) {
          whereClauses.push(eq(roomsTable.buildingId, buildingId));
        }

        const targetRooms = whereClauses.length > 0
          ? await tenantDb.select().from(roomsTable).where(and(...whereClauses))
          : await tenantDb.select().from(roomsTable);

        let createdCount = 0;

        for (const room of targetRooms) {
          // Extract features list
          const rawFeatures: string[] = Array.isArray(room.featuresList) && room.featuresList.length > 0
            ? room.featuresList
            : room.features
            ? String(room.features).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
            : [];

          if (rawFeatures.length === 0) continue;

          // Fetch existing inventory items for this room
          const existingItems = await tenantDb
            .select({ itemName: roomInventoryTable.itemName })
            .from(roomInventoryTable)
            .where(eq(roomInventoryTable.roomId, room.id));

          const existingNames = new Set(
            existingItems.map((item) => item.itemName.trim().toLowerCase())
          );

          // Insert new items that do not exist yet
          for (const feat of rawFeatures) {
            const trimmed = feat.trim();
            if (!trimmed) continue;
            if (existingNames.has(trimmed.toLowerCase())) continue;

            const category = categorizeAmenity(trimmed);
            await tenantDb.insert(roomInventoryTable).values({
              roomId: room.id,
              itemName: trimmed,
              category,
              quantity: 1,
              condition: "good",
              notes: "Generated from room features",
            });

            existingNames.add(trimmed.toLowerCase());
            createdCount++;
          }
        }

        return { createdCount, roomCount: targetRooms.length };
      });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `توليد الجرد تلقائياً من تجهيزات الغرف (${syncResult.createdCount} صنف جديد عبر ${syncResult.roomCount} غرفة)`,
        actionType: "CREATE",
        module: "housing",
      });

      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "sync",
        data: syncResult,
      });

      res.json({
        success: true,
        message: `Successfully synchronized ${syncResult.createdCount} inventory items across ${syncResult.roomCount} rooms`,
        data: syncResult,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/room-inventory/:id/create-ticket ───────────────────────────
// Creates a maintenance ticket for a damaged/needs_repair item
router.post(
  "/:id/create-ticket",
  requirePermission("housing", "edit"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const itemId = parseInt(String(req.params.id), 10);
      if (!propertyId || isNaN(itemId)) {
        res.status(400).json({ success: false, message: "Valid propertyId and itemId required" });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const [item] = await tenantDb
          .select()
          .from(roomInventoryTable)
          .where(eq(roomInventoryTable.id, itemId));

        if (!item) return null;

        // Auto determine ticket category
        let ticketCategory = "maintenance";
        if (item.category === "electronics" || item.category === "appliances") {
          ticketCategory = "appliances";
        } else if (item.category === "furniture") {
          ticketCategory = "furniture";
        } else if (item.category === "fixtures") {
          ticketCategory = "fixtures";
        }

        const problemType = `صيانة/إصلاح: ${item.itemName}`;
        const description = [
          `طلب صيانة عاجل للمعدة: ${item.itemName}`,
          item.serialNumber ? `الرقم التسلسلي (S/N): ${item.serialNumber}` : null,
          item.barcode ? `كود الأصل / الباركود: ${item.barcode}` : null,
          item.notes ? `ملاحظات: ${item.notes}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        const [ticket] = await tenantDb
          .insert(maintenanceTable)
          .values({
            roomId: item.roomId,
            category: ticketCategory,
            problemType,
            description,
            priority: "high",
            status: "open",
            reportedBy: req.body.reportedBy || "Inventory Audit / جرد العهد والمعدات",
          })
          .returning();

        // Update item condition to needs_repair
        await tenantDb
          .update(roomInventoryTable)
          .set({
            condition: "needs_repair",
            updatedAt: new Date(),
          })
          .where(eq(roomInventoryTable.id, itemId));

        return ticket;
      });

      if (!result) {
        res.status(404).json({ success: false, message: "Inventory item not found" });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `إنشاء طلب صيانة للمعدة رقم ${itemId} (تذكرة #${result.id})`,
        actionType: "CREATE",
        module: "maintenance",
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "created",
        entityId: result.id,
        data: { ticket: result },
      });
      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "updated",
        entityId: itemId,
      });

      res.json({
        success: true,
        message: "Maintenance ticket created successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
