import { Router, type Request, type Response } from "express";
import {
  withTenant,
  roomsTable,
  buildingsTable,
  floorsTable,
  roomImportHistoryTable,
  roomImportTemplatesTable,
  roomBedsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";

const router = Router();

/**
 * POST /api/rooms/import/execute
 * Executes universal room configuration import in a single atomic transaction
 */
router.post(
  "/rooms/import/execute",
  requirePermission("housing", "create"),
  async (req: Request, res: Response) => {
    try {
      const propertyId = getTenantId(req) || req.body.propertyId;
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const {
        buildingId: reqBuildingId,
        importMode = "create_update",
        fileName = "room_config.xlsx",
        rooms = [],
      } = req.body;

      if (!Array.isArray(rooms) || rooms.length === 0) {
        res.status(400).json({ error: "No rooms data provided in request" });
        return;
      }

      const userId = (req.session as any)?.userId;
      const username = (req.session as any)?.username || "Admin";

      const result = await withTenant(propertyId, async (tenantDb) => {
        // 1. Resolve Target Building
        let defaultBuildingId = reqBuildingId ? parseInt(String(reqBuildingId), 10) : null;
        const allBuildings = await tenantDb.select().from(buildingsTable);

        if (!defaultBuildingId && allBuildings.length > 0) {
          defaultBuildingId = allBuildings[0].id;
        } else if (!defaultBuildingId) {
          // Create default building if property has none
          const [newB] = await tenantDb
            .insert(buildingsTable)
            .values({
              name: "المبنى الرئيسي (Main Building)",
              location: "Main",
              capacity: rooms.length,
              status: "active",
            })
            .returning();
          defaultBuildingId = newB.id;
          allBuildings.push(newB);
        }

        // Map building names to IDs
        const buildingNameMap = new Map<string, number>();
        allBuildings.forEach((b) => {
          buildingNameMap.set(b.name.trim().toLowerCase(), b.id);
        });

        // 2. Resolve Existing Floors
        const allFloors = await tenantDb.select().from(floorsTable);
        // Map: `${buildingId}_${floorNumber}` -> floorId
        const floorKeyMap = new Map<string, number>();
        allFloors.forEach((f) => {
          floorKeyMap.set(`${f.buildingId}_${f.floorNumber.trim().toLowerCase()}`, f.id);
        });

        // 3. Resolve Existing Rooms
        const existingRoomsList = await tenantDb.select().from(roomsTable);
        // Map: `${buildingId}_${roomNumber}` -> room
        const existingRoomMap = new Map<string, any>();
        existingRoomsList.forEach((r) => {
          existingRoomMap.set(
            `${r.buildingId}_${String(r.roomNumber).trim().toLowerCase()}`,
            r
          );
        });

        let createdRows = 0;
        let updatedRows = 0;
        let failedRows = 0;
        const errors: any[] = [];
        const warnings: any[] = [];
        const processedRoomIds: number[] = [];

        for (let i = 0; i < rooms.length; i++) {
          const r = rooms[i];
          const rowNum = i + 2;

          try {
            const rawRoomNumber = String(r.roomNumber ?? "").trim();
            if (!rawRoomNumber) {
              failedRows++;
              errors.push({
                rowNumber: rowNum,
                column: "Room Number",
                error: "Room number is empty or missing",
                suggestedFix: "Provide a valid room number",
              });
              continue;
            }

            // Resolve building for this room
            let roomBuildingId = defaultBuildingId!;
            if (r.building) {
              const bKey = String(r.building).trim().toLowerCase();
              if (buildingNameMap.has(bKey)) {
                roomBuildingId = buildingNameMap.get(bKey)!;
              } else {
                // Auto-create building if named in file
                const [createdB] = await tenantDb
                  .insert(buildingsTable)
                  .values({
                    name: String(r.building).trim(),
                    location: "",
                    capacity: 50,
                    status: "active",
                  })
                  .returning();
                roomBuildingId = createdB.id;
                buildingNameMap.set(bKey, createdB.id);
              }
            }

            // Resolve floor for this room
            const cleanFloorNumber = String(r.floor || "1").trim();
            const floorKey = `${roomBuildingId}_${cleanFloorNumber.toLowerCase()}`;
            let roomFloorId = floorKeyMap.get(floorKey);

            if (!roomFloorId) {
              // Auto-create floor if not exists
              const [createdF] = await tenantDb
                .insert(floorsTable)
                .values({
                  buildingId: roomBuildingId,
                  floorNumber: cleanFloorNumber,
                  description: `الدور ${cleanFloorNumber}`,
                })
                .returning();
              roomFloorId = createdF.id;
              floorKeyMap.set(floorKey, createdF.id);
            }

            const roomKey = `${roomBuildingId}_${rawRoomNumber.toLowerCase()}`;
            const existingRoom = existingRoomMap.get(roomKey);

            const capacity = Math.max(1, parseInt(String(r.capacity || 1), 10) || 1);
            const roomType = String(r.roomType || "Standard").trim();

            if (existingRoom) {
              // Existing Room
              if (importMode === "create_only") {
                // Skip
                warnings.push({
                  rowNumber: rowNum,
                  column: "Room Number",
                  value: rawRoomNumber,
                  warning: `Room "${rawRoomNumber}" already exists, skipped (Create Only mode)`,
                });
                continue;
              }

              // Update existing room
              await tenantDb
                .update(roomsTable)
                .set({
                  roomType,
                  capacity,
                  floorId: roomFloorId,
                  buildingId: roomBuildingId,
                  view: r.view ? String(r.view).trim() : existingRoom.view,
                  bedType: r.bedType ? String(r.bedType).trim() : existingRoom.bedType,
                  classification: r.classification || roomType,
                  separatorDoor: r.separatorDoor !== undefined ? !!r.separatorDoor : existingRoom.separatorDoor,
                  size: r.size ? String(r.size).trim() : existingRoom.size,
                  sizeSqm: r.sizeSqm !== undefined ? r.sizeSqm : existingRoom.sizeSqm,
                  features: r.features ? String(r.features).trim() : existingRoom.features,
                  featuresList: Array.isArray(r.featuresList) ? r.featuresList : existingRoom.featuresList,
                  gender: r.gender ? String(r.gender).trim() : existingRoom.gender,
                  isActive: true,
                  updatedAt: new Date(),
                })
                .where(eq(roomsTable.id, existingRoom.id));

              // Update physical beds if needed
              const existingBeds = await tenantDb
                .select()
                .from(roomBedsTable)
                .where(eq(roomBedsTable.roomId, existingRoom.id));

              if (existingBeds.length < capacity) {
                for (let b = existingBeds.length + 1; b <= capacity; b++) {
                  await tenantDb.insert(roomBedsTable).values({
                    roomId: existingRoom.id,
                    bedNumber: b,
                    bedType: r.bedType || "Standard Bed",
                    status: "AVAILABLE",
                  });
                }
              }

              updatedRows++;
              processedRoomIds.push(existingRoom.id);
            } else {
              // New Room
              if (importMode === "update_only") {
                // Skip
                warnings.push({
                  rowNumber: rowNum,
                  column: "Room Number",
                  value: rawRoomNumber,
                  warning: `Room "${rawRoomNumber}" does not exist, skipped (Update Only mode)`,
                });
                continue;
              }

              const [newRoom] = await tenantDb
                .insert(roomsTable)
                .values({
                  buildingId: roomBuildingId,
                  floorId: roomFloorId,
                  roomNumber: rawRoomNumber,
                  roomType,
                  capacity,
                  currentOccupancy: 0,
                  status: "available",
                  gender: r.gender ? String(r.gender).trim() : null,
                  view: r.view ? String(r.view).trim() : null,
                  bedType: r.bedType ? String(r.bedType).trim() : null,
                  classification: r.classification || roomType,
                  separatorDoor: !!r.separatorDoor,
                  size: r.size ? String(r.size).trim() : null,
                  sizeSqm: r.sizeSqm !== undefined ? r.sizeSqm : null,
                  features: r.features ? String(r.features).trim() : null,
                  featuresList: Array.isArray(r.featuresList) ? r.featuresList : [],
                  isActive: true,
                })
                .returning();

              // Insert physical bed records
              for (let b = 1; b <= capacity; b++) {
                await tenantDb.insert(roomBedsTable).values({
                  roomId: newRoom.id,
                  bedNumber: b,
                  bedType: r.bedType || "Standard Bed",
                  status: "AVAILABLE",
                });
              }

              createdRows++;
              processedRoomIds.push(newRoom.id);
            }
          } catch (rowErr: any) {
            failedRows++;
            errors.push({
              rowNumber: rowNum,
              column: "General",
              error: rowErr.message || "Failed to process row",
              suggestedFix: "Check row values and format",
            });
          }
        }

        // 4. Handle Replace Configuration mode (Deactivate missing rooms safely)
        if (importMode === "replace" && processedRoomIds.length > 0) {
          await tenantDb
            .update(roomsTable)
            .set({
              isActive: false,
              status: "out_of_service",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(roomsTable.buildingId, defaultBuildingId!),
                sql`${roomsTable.id} NOT IN (${sql.raw(processedRoomIds.join(","))})`
              )
            );
        }

        // 5. Record Import History Entry
        const [historyEntry] = await tenantDb
          .insert(roomImportHistoryTable)
          .values({
            propertyId,
            buildingId: defaultBuildingId,
            fileName: String(fileName).slice(0, 255),
            uploadedBy: userId || null,
            uploadedByName: username,
            importMode,
            totalRows: rooms.length,
            createdRows,
            updatedRows,
            failedRows,
            status: failedRows > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
            errors,
            warnings,
          })
          .returning();

        return {
          success: true,
          importId: historyEntry?.id,
          totalRows: rooms.length,
          createdRows,
          updatedRows,
          failedRows,
          errors,
          warnings,
        };
      });

      // Log Activity
      await logActivity({
        req,
        userId,
        propertyId,
        username,
        action: "IMPORT_ROOMS",
        module: "housing",
        entityType: "ROOM",
        entityId: result.importId || 0,
        details: `Universal Room Import: created ${result.createdRows}, updated ${result.updatedRows}, failed ${result.failedRows} from ${fileName}`,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[Room Import] Error during execution:", err);
      res.status(500).json({ error: err.message || "Failed to execute room import" });
    }
  }
);

/**
 * GET /api/rooms/import/history
 * Fetches recent import logs for the property
 */
router.get(
  "/rooms/import/history",
  requirePermission("housing", "view"),
  async (req: Request, res: Response) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const history = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(roomImportHistoryTable)
        .orderBy(desc(roomImportHistoryTable.createdAt))
        .limit(50);
    });

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch import history" });
  }
});

/**
 * GET /api/rooms/import/templates
 * Fetches saved column mapping templates
 */
router.get(
  "/rooms/import/templates",
  requirePermission("housing", "view"),
  async (req: Request, res: Response) => {
  try {
    const propertyId = getTenantId(req);

    const templates = await withTenant(propertyId || 1, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(roomImportTemplatesTable)
        .orderBy(desc(roomImportTemplatesTable.updatedAt));
    });

    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch templates" });
  }
});

/**
 * POST /api/rooms/import/templates
 * Saves or updates a column mapping template
 */
router.post(
  "/rooms/import/templates",
  requirePermission("housing", "create"),
  async (req: Request, res: Response) => {
  try {
    const propertyId = getTenantId(req) || req.body.propertyId;
    const { name, description = "", columnMapping } = req.body;

    if (!name || !columnMapping) {
      res.status(400).json({ error: "name and columnMapping are required" });
      return;
    }

    const saved = await withTenant(propertyId || 1, async (tenantDb) => {
      const [entry] = await tenantDb
        .insert(roomImportTemplatesTable)
        .values({
          propertyId: propertyId || null,
          name: String(name).trim(),
          description: String(description).trim(),
          columnMapping,
        })
        .returning();
      return entry;
    });

    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save template" });
  }
});

export default router;
