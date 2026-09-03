import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  profilesTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { logActivity } from "../lib/activity-logger.js";
import { ensureProfilePortalAccount } from "../lib/portal-accounts.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { broadcastToProperty } from "../lib/websocket.js";

const HrSyncConfigSchema = z.object({
  apiUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  fieldMapping: z.record(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

const router: Router = Router();

// ========================
// GET /api/hr-sync/config — Get HR sync config for current property
// ========================
router.get(
  "/config",
  requirePermission("settings", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const configRes = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    if (!configRes?.rows?.[0]) {
      // Return default empty config
      res.json({
        success: true,
        config: {
          apiUrl: "",
          apiKey: "",
          fieldMapping: {},
          isActive: false,
          lastSyncAt: null,
        },
      });
      return;
    }
    const row = configRes.rows[0];
    res.json({
      success: true,
      config: {
        id: row.id,
        apiUrl: row.api_url || "",
        apiKey: row.api_key ? "••••••" : "",
        fieldMapping: row.field_mapping || {},
        isActive: row.is_active || false,
        lastSyncAt: row.last_sync_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  },
);

// ========================
// PUT /api/hr-sync/config — Upsert HR sync config
// ========================
router.put(
  "/config",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const parsed = HrSyncConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const { apiUrl, apiKey, fieldMapping, isActive } = parsed.data;

    const existing = await pool.query(
      `SELECT id FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );

    if (existing?.rows?.[0]) {
      const updates: any = { updated_at: new Date() };
      if (apiUrl !== undefined) updates.api_url = apiUrl;
      if (apiKey !== undefined) updates.api_key = apiKey;
      if (fieldMapping !== undefined)
        updates.field_mapping = JSON.stringify(fieldMapping);
      if (isActive !== undefined) updates.is_active = isActive;

      const setClauses = Object.entries(updates)
        .map(([k, v], i) => `${k} = $${i + 2}`)
        .join(", ");
      const values = [propertyId, ...Object.values(updates)];
      await pool.query(
        `UPDATE public.hr_sync_config SET ${setClauses} WHERE property_id = $1`,
        values,
      );
    } else {
      await pool.query(
        `INSERT INTO public.hr_sync_config (property_id, api_url, api_key, field_mapping, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          propertyId,
          apiUrl || "",
          apiKey || "",
          JSON.stringify(fieldMapping || {}),
          isActive || false,
        ],
      );
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تحديث إعدادات ربط HR`,
      actionType: "UPDATE",
      module: "hr_sync",
      entityType: "hr_sync_config",
      entityId: propertyId,
    });

    res.json({ success: true, message: "HR sync config updated" });
  },
);

// ========================
// POST /api/hr-sync/receive — Receive profile data pushed from HR system
// Body: { propertyId, profiles: [{ profileId, firstName, lastName, nationalId, ... }] }
// ========================
router.post("/receive", async (req, res): Promise<void> => {
  const expectedKey = process.env["HR_SYNC_API_KEY"];
  if (expectedKey) {
    const providedKey = req.headers["x-api-key"];
    if (providedKey !== expectedKey) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "HR_SYNC_API_KEY not configured — webhook access denied in production" });
    return;
  }

  const propertyId =
    Number(req.body?.propertyId) || Number(req.query?.propertyId);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const { profiles } = req.body as any;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    res.status(400).json({ error: "profiles array required" });
    return;
  }

  let created = 0,
    updated = 0,
    errors: string[] = [];

  // Batch: fetch all existing profileIds in one query, then insert/update in one transaction
  await withTenant(propertyId, async (tenantDb) => {
    const empIds = profiles
      .filter((e: any) => e.profileId)
      .map((e: any) => String(e.profileId));
    const existingRows =
      empIds.length > 0
        ? await tenantDb
            .select()
            .from(profilesTable)
            .where(inArray(profilesTable.profileId, empIds))
        : [];
    const existingMap = new Map(
      existingRows.map((e: any) => [e.profileId, e]),
    );

    for (const emp of profiles) {
      try {
        if (!emp.profileId) {
          errors.push(`Missing profileId for record`);
          continue;
        }
        const existing = existingMap.get(String(emp.profileId));

        if (existing) {
          await tenantDb
            .update(profilesTable)
            .set({
              firstName: emp.firstName || existing.firstName,
              lastName: emp.lastName || existing.lastName,
              nationalId: emp.nationalId || existing.nationalId,
              nationality: emp.nationality || existing.nationality,
              jobTitle: emp.jobTitle || existing.jobTitle,
              department: emp.department || existing.department,
              phone: emp.phone || existing.phone,
              address: emp.address || existing.address,
              status: emp.status || existing.status,
              gender: emp.gender || existing.gender,
              level: emp.level || existing.level,
              hireDate: emp.hireDate || existing.hireDate,
            })
            .where(eq(profilesTable.profileId, emp.profileId));
          updated++;
        } else {
          await tenantDb.insert(profilesTable).values({
            profileId: emp.profileId,
            firstName: emp.firstName || "",
            lastName: emp.lastName || "",
            nationalId: emp.nationalId || "",
            nationality: emp.nationality || "",
            jobTitle: emp.jobTitle || "",
            department: emp.department || "",
            phone: emp.phone || "",
            address: emp.address || "",
            status: emp.status || "active",
            gender: emp.gender || "male",
            level: emp.level || "",
            hireDate: emp.hireDate || new Date().toISOString().split("T")[0],
          });
          created++;
        }
      } catch (err: any) {
        errors.push(`${emp.profileId || "unknown"}: sync error`);
      }
    }
  });

  // Ensure portal accounts (outside tenant transaction, one per profile)
  for (const emp of profiles) {
    if (emp.profileId) {
      try {
        await ensureProfilePortalAccount(propertyId, emp.profileId);
      } catch {}
    }
  }

  // Log sync result
  await pool.query(
    `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
     VALUES ($1, 'push', $2, $3, $4, $5, $6, NOW() - interval '1 second', NOW())`,
    [
      propertyId,
      errors.length > 0 ? "completed_with_errors" : "completed",
      profiles.length,
      created,
      updated,
      errors.join("; ") || null,
    ],
  );

  const s = su(req);
  await logActivity({
    req,
    propertyId,
    username: s.username,
    userId: s.userId,
    userRole: s.userRole,
    action: `استقبال بيانات موظفين من HR — تم إنشاء ${created} وتحديث ${updated}`,
    actionType: "SYNC",
    module: "hr_sync",
    entityType: "profile",
    entityId: propertyId,
  });

  res.json({
    success: true,
    stats: {
      received: profiles.length,
      created,
      updated,
      errors: errors.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ========================
// POST /api/hr-sync/sync — Pull profiles from external HR API
// ========================
router.post(
  "/sync",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const configResult = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1 AND is_active = true`,
      [propertyId],
    );
    const config = configResult?.rows?.[0];
    if (!config) {
      res.status(400).json({
        error: "HR sync not configured or not active for this property",
      });
      return;
    }

    if (!config.api_url) {
      res.status(400).json({ error: "API URL not configured" });
      return;
    }

    const logEntry = await pool.query(
      `INSERT INTO public.hr_sync_log (property_id, sync_type, status, started_at)
     VALUES ($1, 'pull', 'in_progress', NOW()) RETURNING id`,
      [propertyId],
    );
    const logId = logEntry?.rows?.[0]?.id;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.api_key) headers["Authorization"] = `Bearer ${config.api_key}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(config.api_url, {
        headers,
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
      if (!response.ok)
        throw new Error(
          `HR API returned ${response.status}: ${response.statusText}`,
        );

      const data = (await response.json()) as any;
      const profiles = Array.isArray(data)
        ? data
        : data.profiles || data.data || [];

      if (!Array.isArray(profiles) || profiles.length === 0) {
        throw new Error("No profiles data received from HR API");
      }

      // Map fields if mapping is configured
      const mapping = config.field_mapping || {};
      const mappedProfiles = profiles.map((emp: any) => {
        if (Object.keys(mapping).length > 0) {
          const mapped: any = {};
          for (const [targetField, sourceField] of Object.entries(mapping)) {
            mapped[targetField] = emp[sourceField as string];
          }
          return mapped;
        }
        return emp;
      });

      // Process via receive handler
      const receiveRes = await new Promise<any>((resolve, reject) => {
        const mockReq = { body: { propertyId, profiles: mappedProfiles } };
        const mockRes: any = {
          json: (data: any) => resolve(data),
          status: () => mockRes,
        };
        // Forward to receive endpoint
        const receiveRouter = Router();
        // Instead of re-calling, process inline
        processReceive(propertyId, mappedProfiles, mockReq, mockRes).catch(
          reject,
        );
      });

      // Update sync log
      await pool.query(
        `UPDATE public.hr_sync_log SET status = $1, records_processed = $2, records_created = $3, records_updated = $4, errors = $5, completed_at = NOW()
       WHERE id = $6`,
        [
          receiveRes.errors?.length > 0 ? "completed_with_errors" : "completed",
          receiveRes.stats?.received || 0,
          receiveRes.stats?.created || 0,
          receiveRes.stats?.updated || 0,
          receiveRes.errors?.join("; ") || null,
          logId,
        ],
      );

      // Update last sync timestamp
      await pool.query(
        `UPDATE public.hr_sync_config SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [config.id],
      );

      res.json(receiveRes);
    } catch (err: any) {
      await pool.query(
        `UPDATE public.hr_sync_log SET status = 'failed', errors = $1, completed_at = NOW() WHERE id = $2`,
        [err.message, logId],
      );
      res.status(500).json({ success: false, error: "Sync failed" });
    }
  },
);

// Inline receive processor (batched for performance)
async function processReceive(
  propertyId: number,
  profiles: any[],
  req: any,
  res: any,
) {
  let created = 0,
    updated = 0,
    errors: string[] = [];

  await withTenant(propertyId, async (tenantDb) => {
    const empIds = profiles
      .filter((e: any) => e.profileId)
      .map((e: any) => String(e.profileId));
    const existingRows =
      empIds.length > 0
        ? await tenantDb
            .select()
            .from(profilesTable)
            .where(inArray(profilesTable.profileId, empIds))
        : [];
    const existingMap = new Map(
      existingRows.map((e: any) => [e.profileId, e]),
    );

    for (const emp of profiles) {
      try {
        if (!emp.profileId) {
          errors.push(`Missing profileId for record`);
          continue;
        }
        const existing = existingMap.get(String(emp.profileId));

        if (existing) {
          await tenantDb
            .update(profilesTable)
            .set({
              firstName: emp.firstName || existing.firstName,
              lastName: emp.lastName || existing.lastName,
              nationalId: emp.nationalId || existing.nationalId,
              nationality: emp.nationality || existing.nationality,
              jobTitle: emp.jobTitle || existing.jobTitle,
              department: emp.department || existing.department,
              phone: emp.phone || existing.phone,
              address: emp.address || existing.address,
              status: emp.status || existing.status,
              gender: emp.gender || existing.gender,
              level: emp.level || existing.level,
              hireDate: emp.hireDate || existing.hireDate,
            })
            .where(eq(profilesTable.profileId, emp.profileId));
          updated++;
        } else {
          await tenantDb.insert(profilesTable).values({
            profileId: emp.profileId,
            firstName: emp.firstName || "",
            lastName: emp.lastName || "",
            nationalId: emp.nationalId || "",
            nationality: emp.nationality || "",
            jobTitle: emp.jobTitle || "",
            department: emp.department || "",
            phone: emp.phone || "",
            address: emp.address || "",
            status: emp.status || "active",
            gender: emp.gender || "male",
            level: emp.level || "",
            hireDate: emp.hireDate || new Date().toISOString().split("T")[0],
          });
          created++;
        }
      } catch (err: any) {
        errors.push(`${emp.profileId || "unknown"}: sync error`);
      }
    }
  });

  for (const emp of profiles) {
    if (emp.profileId) {
      try {
        await ensureProfilePortalAccount(propertyId, emp.profileId);
      } catch {}
    }
  }

  await pool.query(
    `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
     VALUES ($1, 'push', $2, $3, $4, $5, $6, NOW() - interval '1 second', NOW())`,
    [
      propertyId,
      errors.length > 0 ? "completed_with_errors" : "completed",
      profiles.length,
      created,
      updated,
      errors.length > 0 ? `${errors.length} errors` : null,
    ],
  );

  return {
    success: true,
    stats: {
      received: profiles.length,
      created,
      updated,
      errors: errors.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ========================
// GET /api/hr-sync/logs — Get sync history for current property
// ========================
router.get(
  "/logs",
  requirePermission("settings", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const limit = Math.min(Number(req.query?.limit) || 20, 100);
    const result = await pool.query(
      `SELECT * FROM public.hr_sync_log WHERE property_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [propertyId, limit],
    );

    res.json({ success: true, logs: result?.rows || [] });
  },
);

// ========================
// GET /api/hr-sync/profiles/:profileId — Full profile data for HR system
// ========================
router.get("/profiles/:profileId", async (req, res): Promise<void> => {
  const expectedKey = process.env["HR_SYNC_API_KEY"];
  if (expectedKey) {
    const providedKey = req.headers["x-api-key"];
    if (providedKey !== expectedKey) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "HR_SYNC_API_KEY not configured — access denied in production" });
    return;
  }

  const propertyId = getTenantId(req);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const { profileId } = req.params;
  if (!profileId) {
    res.status(400).json({ error: "profileId required" });
    return;
  }

  await withTenant(propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.profileId, profileId));

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    const [assignment] = await tenantDb
      .select({
        id: assignmentsTable.id,
        bedNumber: assignmentsTable.bedNumber,
        checkInDate: assignmentsTable.checkInDate,
        expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
        checkOutDate: assignmentsTable.checkOutDate,
        notes: assignmentsTable.notes,
        status: assignmentsTable.status,
        roomNumber: roomsTable.roomNumber,
        roomType: roomsTable.roomType,
        capacity: roomsTable.capacity,
        buildingName: buildingsTable.name,
      })
      .from(assignmentsTable)
      .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
      .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
      .where(
        and(
          eq(assignmentsTable.profileId, profile.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    res.json({
      success: true,
      profile,
      currentAssignment: assignment || null,
    });
  });
});

// ========================
// POST /api/hr-sync/notify-departure — HR system notifies that an profile has left/been terminated
// Body: { profileId, departureDate?, reason? }
// ========================
router.post("/notify-departure", async (req, res): Promise<void> => {
  const expectedKey = process.env["HR_SYNC_API_KEY"];
  if (expectedKey) {
    const providedKey = req.headers["x-api-key"];
    if (providedKey !== expectedKey) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "HR_SYNC_API_KEY not configured — webhook access denied in production" });
    return;
  }

  const propertyId =
    Number(req.body?.propertyId) || Number(req.query?.propertyId);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const { profileId, departureDate, reason } = req.body as any;
  if (!profileId) {
    res.status(400).json({ error: "profileId required" });
    return;
  }

  let checkoutResult: any = null;
  let updatedProfile: any = null;

  await withTenant(propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.profileId, String(profileId)));

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    // Update profile status to departed
    const [emp] = await tenantDb
      .update(profilesTable)
      .set({ status: "departed" })
      .where(eq(profilesTable.profileId, String(profileId)))
      .returning();
    updatedProfile = emp;

    // Find active assignment and auto-checkout
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, profile.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    if (assignment) {
      const checkOutDate =
        departureDate || new Date().toISOString().split("T")[0];
      const notes = reason
        ? `Auto checkout — ${reason}`
        : "Auto checkout — HR departure notification";

      await tenantDb
        .update(assignmentsTable)
        .set({ status: "CHECKED_OUT", checkOutDate, notes })
        .where(eq(assignmentsTable.id, assignment.id));

      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, assignment.roomId));

      if (room) {
        const newOcc = Math.max(0, room.currentOccupancy - 1);
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: newOcc,
            status: newOcc === 0 ? "available" : "occupied",
          })
          .where(eq(roomsTable.id, room.id));
      }

      checkoutResult = {
        assignmentId: assignment.id,
        checkOutDate,
        roomId: room?.id,
      };

      // Broadcast to live clients
      broadcastToProperty(propertyId, {
        module: "accommodation",
        action: "checkout",
        entityId: assignment.id,
      });
      if (room)
        broadcastToProperty(propertyId, {
          module: "housing",
          action: "updated",
          entityId: room.id,
        });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    }
  });

  if (res.headersSent) return;

  // Log activity
  const s = su(req);
  await logActivity({
    req,
    propertyId,
    username: s?.username || "hr-sync",
    userId: s?.userId || 0,
    userRole: s?.userRole || "system",
    action:
      `مغادرة تلقائية للموظف #${profileId} من HR` +
      (checkoutResult ? " — تم إنهاء السكن" : ""),
    actionType: "UPDATE",
    module: "hr_sync",
    entityType: "profile",
    entityId: profileId,
  });

  // Sync log
  await pool.query(
    `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
     VALUES ($1, 'departure', 'completed', 1, 0, 1, NULL, NOW() - interval '1 second', NOW())`,
    [propertyId],
  );

  res.json({
    success: true,
    message:
      "Profile marked as departed" +
      (checkoutResult ? " and checked out" : ""),
    profile: updatedProfile,
    autoCheckout: checkoutResult,
  });
});

export default router;
