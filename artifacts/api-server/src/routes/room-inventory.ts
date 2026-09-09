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

// Helper to normalize Arabic and English item names
export function normalizeItemName(name: string): string {
  if (!name) return "";
  let s = name.trim().toLowerCase();
  // Unify Arabic alef variants
  s = s.replace(/[إأآا]/g, "ا");
  // Unify taa marbuta and haa
  s = s.replace(/ة/g, "ه");
  // Unify yaa and alef maqsura
  s = s.replace(/ى/g, "ي");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ");
  return s;
}

// Comprehensive helper to categorize room amenities (Arabic & English)
export function categorizeAmenity(name: string): string {
  const n = normalizeItemName(name);

  // 1. APPLIANCES & ELECTRICAL ("أجهزة كهربائية وتكييف / Electric")
  if (
    // English
    n.includes("fridge") ||
    n.includes("refrigerator") ||
    n.includes("mini fridge") ||
    n.includes("freezer") ||
    n.includes("air condition") ||
    n.includes("air-condition") ||
    n.includes("aircondition") ||
    n.includes("ac") ||
    n.includes("a/c") ||
    n.includes("hvac") ||
    n.includes("cooler") ||
    n.includes("washing") ||
    n.includes("washer") ||
    n.includes("iron") ||
    n.includes("kettle") ||
    n.includes("microwave") ||
    n.includes("heater") ||
    n.includes("dryer") ||
    n.includes("cooker") ||
    n.includes("stove") ||
    n.includes("toaster") ||
    n.includes("electric") ||
    n.includes("electrical") ||
    n.includes("fan") ||
    n.includes("blender") ||
    n.includes("vacuum") ||
    // Arabic (normalized: ا / ه / ي)
    n.includes("ثلاجه") ||
    n.includes("تلاجه") ||
    n.includes("ميني بار") ||
    n.includes("فريزر") ||
    n.includes("تكييف") ||
    n.includes("مكيف") ||
    n.includes("تبريد") ||
    n.includes("غساله") ||
    n.includes("نشافه") ||
    n.includes("مكواه") ||
    n.includes("غلايه") ||
    n.includes("كاتل") ||
    n.includes("بويلر") ||
    n.includes("ميكروويف") ||
    n.includes("مايكروويف") ||
    n.includes("سخان") ||
    n.includes("مروحه") ||
    n.includes("بوتجاز") ||
    n.includes("بوتاجاز") ||
    n.includes("فرن") ||
    n.includes("شوايه") ||
    n.includes("كهرباي") ||
    n.includes("اجهزه")
  ) {
    return "appliances";
  }

  // 2. ELECTRONICS & SCREENS ("إلكترونيات وشاشات")
  if (
    // English
    n.includes("tv") ||
    n.includes("television") ||
    n.includes("screen") ||
    n.includes("led") ||
    n.includes("lcd") ||
    n.includes("satellite") ||
    n.includes("receiver") ||
    n.includes("wifi") ||
    n.includes("wi-fi") ||
    n.includes("router") ||
    n.includes("modem") ||
    n.includes("phone") ||
    n.includes("telephone") ||
    n.includes("intercom") ||
    n.includes("computer") ||
    n.includes("monitor") ||
    n.includes("pc") ||
    n.includes("speaker") ||
    n.includes("audio") ||
    // Arabic (normalized)
    n.includes("تلفزيون") ||
    n.includes("تلفاز") ||
    n.includes("شاشه") ||
    n.includes("ريسيفر") ||
    n.includes("رسيفر") ||
    n.includes("ستالايت") ||
    n.includes("واي فاي") ||
    n.includes("راوتر") ||
    n.includes("مودم") ||
    n.includes("انترنت") ||
    n.includes("هاتف") ||
    n.includes("تليفون") ||
    n.includes("انتركم") ||
    n.includes("كمبيوتر") ||
    n.includes("سماعه")
  ) {
    return "electronics";
  }

  // 3. FURNITURE ("أثاث وغرف نوم")
  if (
    // English
    n.includes("wardrobe") ||
    n.includes("desk") ||
    n.includes("chair") ||
    n.includes("bed") ||
    n.includes("mattress") ||
    n.includes("sofa") ||
    n.includes("couch") ||
    n.includes("seating") ||
    n.includes("table") ||
    n.includes("closet") ||
    n.includes("cupboard") ||
    n.includes("nightstand") ||
    n.includes("dresser") ||
    n.includes("shelf") ||
    n.includes("bookshelf") ||
    n.includes("drawer") ||
    // Arabic (normalized)
    n.includes("سرير") ||
    n.includes("سراير") ||
    n.includes("اسره") ||
    n.includes("مرتبه") ||
    n.includes("دولاب") ||
    n.includes("دواليب") ||
    n.includes("مكتب") ||
    n.includes("كرسي") ||
    n.includes("كراسي") ||
    n.includes("كنبه") ||
    n.includes("صوفا") ||
    n.includes("جلسه") ||
    n.includes("جلوس") ||
    n.includes("طاوله") ||
    n.includes("ترابيزه") ||
    n.includes("طربيزه") ||
    n.includes("كومود") ||
    n.includes("تسريحه") ||
    n.includes("انتريه") ||
    n.includes("صالون") ||
    n.includes("غرفه نوم") ||
    n.includes("دريسنج")
  ) {
    return "furniture";
  }

  // 4. FIXTURES & SAFES ("مرافق وخزائن")
  if (
    // English
    n.includes("safe") ||
    n.includes("mirror") ||
    n.includes("curtain") ||
    n.includes("drapes") ||
    n.includes("balcony") ||
    n.includes("terrace") ||
    n.includes("bathroom") ||
    n.includes("bath room") ||
    n.includes("bath") ||
    n.includes("shower") ||
    n.includes("cabin") ||
    n.includes("toilet") ||
    n.includes("sink") ||
    n.includes("basin") ||
    n.includes("tap") ||
    n.includes("faucet") ||
    n.includes("kitchenette") ||
    n.includes("kitchen") ||
    n.includes("lamp") ||
    n.includes("light") ||
    n.includes("chandelier") ||
    n.includes("hanger") ||
    n.includes("bin") ||
    // Arabic (normalized)
    n.includes("خزنه") ||
    n.includes("سيف") ||
    n.includes("امانات") ||
    n.includes("مراه") ||
    n.includes("مرايه") ||
    n.includes("ستاره") ||
    n.includes("ستائر") ||
    n.includes("بلكونه") ||
    n.includes("تراس") ||
    n.includes("شرفه") ||
    n.includes("حمام") ||
    n.includes("تواليت") ||
    n.includes("مرحاض") ||
    n.includes("شاور") ||
    n.includes("دش") ||
    n.includes("كابينه") ||
    n.includes("حوض") ||
    n.includes("خلاط") ||
    n.includes("صنبور") ||
    n.includes("حنفيه") ||
    n.includes("مطبخ") ||
    n.includes("اباجوره") ||
    n.includes("نجفه") ||
    n.includes("شماعه") ||
    n.includes("سله")
  ) {
    return "fixtures";
  }

  // 5. LINEN & BEDDING ("مفروشات وبياضات")
  if (
    // English
    n.includes("linen") ||
    n.includes("bedding") ||
    n.includes("pillow") ||
    n.includes("blanket") ||
    n.includes("towel") ||
    n.includes("sheet") ||
    n.includes("quilt") ||
    n.includes("duvet") ||
    n.includes("carpet") ||
    n.includes("rug") ||
    // Arabic (normalized)
    n.includes("مفروشات") ||
    n.includes("بياضات") ||
    n.includes("ملايه") ||
    n.includes("مخده") ||
    n.includes("وساده") ||
    n.includes("بطانيه") ||
    n.includes("لحاف") ||
    n.includes("كوفرته") ||
    n.includes("فوطه") ||
    n.includes("بشكير") ||
    n.includes("سجاده") ||
    n.includes("موكيت")
  ) {
    return "linen";
  }

  return "other";
}

// Sync room features into roomInventoryTable for a single room
export async function syncRoomFeaturesToInventory(
  propertyId: number,
  roomId: number,
  featuresList: string[]
): Promise<{ added: number; removed: number }> {
  if (!propertyId || !roomId) return { added: 0, removed: 0 };

  return await withTenant(propertyId, async (tenantDb) => {
    // 1. Fetch existing inventory items for this room
    const existingItems = await tenantDb
      .select()
      .from(roomInventoryTable)
      .where(eq(roomInventoryTable.roomId, roomId));

    const existingMap = new Map<string, any>();
    for (const item of existingItems) {
      existingMap.set(normalizeItemName(item.itemName), item);
    }

    let added = 0;
    let removed = 0;
    const currentFeaturesNorm = new Set<string>();

    // 2. Parse and insert new features
    const parsedFeatures: string[] = [];
    for (const raw of featuresList) {
      const subItems = String(raw).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      for (const item of subItems) {
        if (item) parsedFeatures.push(item);
      }
    }

    for (const feat of parsedFeatures) {
      const trimmed = feat.trim();
      if (!trimmed) continue;

      const norm = normalizeItemName(trimmed);
      currentFeaturesNorm.add(norm);

      if (!existingMap.has(norm)) {
        const category = categorizeAmenity(trimmed);
        await tenantDb.insert(roomInventoryTable).values({
          roomId,
          itemName: trimmed,
          category,
          quantity: 1,
          condition: "good",
          notes: "Generated from room features",
        });
        added++;
      }
    }

    // 3. Clean up auto-generated items that were removed from room features
    for (const item of existingItems) {
      const isAutoGenerated =
        item.notes === "Generated from room features" ||
        item.notes === null ||
        item.notes === "";
      const hasSpecificDetails = Boolean(item.serialNumber || item.barcode || item.modelNumber);

      const norm = normalizeItemName(item.itemName);
      if (isAutoGenerated && !hasSpecificDetails && !currentFeaturesNorm.has(norm)) {
        await tenantDb
          .delete(roomInventoryTable)
          .where(eq(roomInventoryTable.id, item.id));
        removed++;
      }
    }

    return { added, removed };
  });
}

// Sync features across all rooms for a property
export async function syncAllRoomsFeaturesToInventory(
  propertyId: number
): Promise<{ roomCount: number; addedCount: number }> {
  if (!propertyId) return { roomCount: 0, addedCount: 0 };

  return await withTenant(propertyId, async (tenantDb) => {
    const rooms = await tenantDb.select().from(roomsTable);
    let addedCount = 0;

    for (const room of rooms) {
      const rawFeatures: string[] =
        Array.isArray(room.featuresList) && room.featuresList.length > 0
          ? room.featuresList
          : room.features
          ? String(room.features).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
          : [];

      if (rawFeatures.length === 0) continue;

      const res = await syncRoomFeaturesToInventory(propertyId, room.id, rawFeatures);
      addedCount += res.added;
    }

    return { roomCount: rooms.length, addedCount };
  });
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

              const normName = normalizeItemName(r.itemName);
              const normCat = (r.category || "other").toLowerCase();
              const key = `${normName}:::${normCat}`;
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

      let syncResult = { createdCount: 0, roomCount: 0 };

      if (roomId && !isNaN(roomId)) {
        const [targetRoom] = await withTenant(propertyId, async (tenantDb) =>
          tenantDb.select().from(roomsTable).where(eq(roomsTable.id, roomId))
        );
        if (targetRoom) {
          const rawFeatures: string[] =
            Array.isArray(targetRoom.featuresList) && targetRoom.featuresList.length > 0
              ? targetRoom.featuresList
              : targetRoom.features
              ? String(targetRoom.features).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
              : [];
          const res = await syncRoomFeaturesToInventory(propertyId, targetRoom.id, rawFeatures);
          syncResult = { createdCount: res.added, roomCount: 1 };
        }
      } else {
        const res = await syncAllRoomsFeaturesToInventory(propertyId);
        syncResult = { createdCount: res.addedCount, roomCount: res.roomCount };
      }

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
