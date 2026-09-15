import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import {
  db,
  withTenant,
  profilesTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  propertiesTable,
  gateLogsTable,
} from "@workspace/db";
import { eq, and, desc, sql, or, ilike } from "drizzle-orm";
import { getTenantId, su } from "../lib/request-utils.js";
import { requireAuth, loadAuthUser } from "../middlewares/permissions.js";
import { portalSession } from "./portal-auth.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();
const GATE_SECRET = process.env.GATE_SECRET || "sunrise_gate_pass_super_secret_key_2026";

function generateSignature(profileId: number, employeeId: string, propertyId: number, roomNumber: string): string {
  const hmac = crypto.createHmac("sha256", GATE_SECRET);
  hmac.update(`${profileId}:${employeeId}:${propertyId}:${roomNumber}`);
  return hmac.digest("hex").slice(0, 16);
}

// Allow admin session or employee portal session
const allowAdminOrPortalAuth = async (req: any, res: any, next: any) => {
  // 1. Employee portal session
  const pSess = portalSession(req);
  if (pSess) {
    (req as any).portalUser = pSess;
    return next();
  }

  // 2. Admin express session
  if (req.session?.userId || (req.session as any)?.user) {
    return next();
  }

  // 3. Fallback to auth token / header
  try {
    const user = await loadAuthUser(req, res);
    if (user) return next();
  } catch {}

  res.status(401).json({ error: "Authentication required" });
};

// ─── 1. GET /gate/pass/:profileId ──────────────────────────────────────────
// Generates official scannable Gate Pass with real QR Code
router.get("/gate/pass/:profileId", allowAdminOrPortalAuth, async (req, res): Promise<void> => {
  try {
    const rawPropertyId = req.query.propertyId ? Number(req.query.propertyId) : getTenantId(req);
    let profileIdNum: number;

    if (req.params.profileId === "me") {
      const pSess = portalSession(req) || (req as any).portalUser;
      if (!pSess?.profileDbId) {
        res.status(400).json({ error: "Profile not found in portal session" });
        return;
      }
      profileIdNum = pSess.profileDbId;
    } else {
      profileIdNum = Number(req.params.profileId);
      if (isNaN(profileIdNum)) {
        res.status(400).json({ error: "Invalid profile ID" });
        return;
      }
    }

    // Try finding the profile in tenant schema or public
    let profile: any = null;
    let activeAssignment: any = null;
    let roomInfo: any = null;
    let buildingInfo: any = null;
    let propertyId = rawPropertyId || 1;

    // Helper to query within a tenant
    const loadProfileData = async (tenantDb: any, propId: number) => {
      const [p] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, profileIdNum))
        .limit(1);

      if (!p) return null;

      // Find active assignment
      const [assign] = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, profileIdNum),
            eq(assignmentsTable.status, "ACTIVE")
          )
        )
        .orderBy(desc(assignmentsTable.id))
        .limit(1);

      let r = null;
      let b = null;
      if (assign?.roomId) {
        const [rm] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, assign.roomId))
          .limit(1);
        r = rm;
        if (rm?.buildingId) {
          const [bld] = await tenantDb
            .select()
            .from(buildingsTable)
            .where(eq(buildingsTable.id, rm.buildingId))
            .limit(1);
          b = bld;
        }
      }

      return { profile: p, assignment: assign, room: r, building: b, propertyId: propId };
    };

    if (propertyId) {
      try {
        const data = await withTenant(propertyId, (tdb) => loadProfileData(tdb, propertyId));
        if (data) {
          profile = data.profile;
          activeAssignment = data.assignment;
          roomInfo = data.room;
          buildingInfo = data.building;
        }
      } catch (_) {}
    }

    // Fallback: query public or all properties if not found
    if (!profile) {
      const { rows: allProps } = await db.execute(sql`SELECT id FROM public.properties WHERE is_active = true`);
      for (const pr of allProps) {
        try {
          const data = await withTenant(pr.id, (tdb) => loadProfileData(tdb, pr.id));
          if (data) {
            profile = data.profile;
            activeAssignment = data.assignment;
            roomInfo = data.room;
            buildingInfo = data.building;
            propertyId = pr.id;
            break;
          }
        } catch (_) {}
      }
    }

    if (!profile) {
      res.status(404).json({ error: "Resident profile not found" });
      return;
    }

    // Fetch Property Name
    const [property] = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name, displayName: propertiesTable.displayName })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, propertyId))
      .limit(1);

    const employeeId = String(profile.profileId || profile.id);
    const roomNumber = roomInfo?.roomNumber || "UNASSIGNED";
    const buildingName = buildingInfo?.name || "Main Campus";
    const bedNumber = activeAssignment?.bedNumber ? String(activeAssignment.bedNumber) : "1";
    const isAssigned = Boolean(activeAssignment && activeAssignment.status === "ACTIVE");

    // Generate security HMAC token
    const signature = generateSignature(profile.id, employeeId, propertyId, roomNumber);

    // Payload formatted for standard gate scanners
    const qrPayload = `SUNRISE:GATE:P${propertyId}:E${employeeId}:PID${profile.id}:R${roomNumber}:SIG${signature}`;

    // Generate high-resolution scannable QR Code PNG Data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400,
      color: {
        dark: "#0F2A44",
        light: "#FFFFFF",
      },
    });

    const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.fullName || `Staff #${employeeId}`;

    res.json({
      success: true,
      gatePass: {
        profileId: profile.id,
        employeeId,
        fullName,
        fullNameEn: profile.fullNameEn || fullName,
        department: profile.department || "General",
        jobTitle: profile.jobTitle || "Staff",
        nationalId: profile.nationalId || "",
        nationality: profile.nationality || "",
        photoUrl: profile.photoUrl || null,
        housing: {
          isAssigned,
          status: isAssigned ? "ACTIVE" : (profile.status === "vacation" ? "VACATION" : "UNASSIGNED"),
          roomNumber,
          buildingName,
          floorNumber: roomInfo?.floorId || 1,
          bedNumber,
          checkinDate: activeAssignment?.actualCheckinDate || activeAssignment?.startDate || profile.hireDate || null,
        },
        property: {
          id: propertyId,
          name: property?.displayName || property?.name || "Sunrise Staff Housing",
        },
        qrPayload,
        qrDataUrl,
        signature,
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[GatePass] Error generating pass:", error);
    res.status(500).json({ error: error.message || "Failed to generate gate pass" });
  }
});

// ─── 2. POST /gate/verify ──────────────────────────────────────────────────
// Security verification at the electronic gate (Camera scanner / barcode gun)
router.post("/gate/verify", requireAuth, async (req, res): Promise<void> => {
  try {
    const { qrPayload, employeeId: inputEmpId, propertyId: inputPropId } = req.body;

    let targetEmployeeId = inputEmpId ? String(inputEmpId).trim() : "";
    let targetProfileId: number | null = null;
    let targetPropertyId = inputPropId ? Number(inputPropId) : getTenantId(req) || 1;

    // If QR payload received, parse format: SUNRISE:GATE:P{p}:E{emp}:PID{pid}:R{room}:SIG{sig}
    // or legacy format: SUNRISE_RESIDENT:{empId}:{room}:{name}
    if (qrPayload && typeof qrPayload === "string") {
      const trimmedPayload = qrPayload.trim();
      if (trimmedPayload.startsWith("SUNRISE_RESIDENT:")) {
        const parts = trimmedPayload.split(":");
        targetEmployeeId = parts[1] || "";
      } else {
        const parts = trimmedPayload.split(":");
        for (const part of parts) {
          if (part.startsWith("E") && !part.startsWith("EXP")) targetEmployeeId = part.slice(1);
          if (part.startsWith("PID")) targetProfileId = Number(part.slice(3));
          if (part.startsWith("P") && !part.startsWith("PID")) targetPropertyId = Number(part.slice(1));
        }
      }
    }

    if (!targetEmployeeId && !targetProfileId) {
      res.status(400).json({
        success: false,
        verdict: "DENIED",
        reason: "لم يتم التعرف على كود الموظف أو رمز الـ QR / Invalid QR payload",
      });
      return;
    }

    // Search across tenants if not found in current property
    let foundProfile: any = null;
    let activeAssignment: any = null;
    let roomInfo: any = null;
    let buildingInfo: any = null;
    let propertyIdUsed = targetPropertyId;

    const findResidentInTenant = async (tenantDb: any, pId: number) => {
      let query = tenantDb.select().from(profilesTable);
      if (targetProfileId) {
        query = query.where(eq(profilesTable.id, targetProfileId));
      } else {
        query = query.where(
          or(
            eq(profilesTable.profileId, targetEmployeeId),
            sql`CAST(${profilesTable.id} AS TEXT) = ${targetEmployeeId}`,
            eq(profilesTable.nationalId, targetEmployeeId)
          )
        );
      }
      const [p] = await query.limit(1);
      if (!p) return null;

      // Check active assignment
      const [assign] = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, p.id),
            eq(assignmentsTable.status, "ACTIVE")
          )
        )
        .orderBy(desc(assignmentsTable.id))
        .limit(1);

      let r = null;
      let b = null;
      if (assign?.roomId) {
        const [rm] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, assign.roomId))
          .limit(1);
        r = rm;
        if (rm?.buildingId) {
          const [bld] = await tenantDb
            .select()
            .from(buildingsTable)
            .where(eq(buildingsTable.id, rm.buildingId))
            .limit(1);
          b = bld;
        }
      }

      return { profile: p, assignment: assign, room: r, building: b, propertyId: pId };
    };

    // 1. Try target property
    try {
      const data = await withTenant(propertyIdUsed, (tdb) => findResidentInTenant(tdb, propertyIdUsed));
      if (data) {
        foundProfile = data.profile;
        activeAssignment = data.assignment;
        roomInfo = data.room;
        buildingInfo = data.building;
      }
    } catch (_) {}

    // 2. If not found, search other active properties
    if (!foundProfile) {
      const { rows: allProps } = await db.execute(sql`SELECT id FROM public.properties WHERE is_active = true`);
      for (const pr of allProps) {
        if (pr.id === propertyIdUsed) continue;
        try {
          const data = await withTenant(pr.id, (tdb) => findResidentInTenant(tdb, pr.id));
          if (data) {
            foundProfile = data.profile;
            activeAssignment = data.assignment;
            roomInfo = data.room;
            buildingInfo = data.building;
            propertyIdUsed = pr.id;
            break;
          }
        } catch (_) {}
      }
    }

    // Resident not found in database
    if (!foundProfile) {
      res.json({
        success: true,
        verdict: "DENIED",
        statusCode: "RESIDENT_NOT_FOUND",
        reason: "الموظف غير مسجل بنظام السكن / Resident not found in housing records",
        employeeId: targetEmployeeId,
      });
      return;
    }

    const [prop] = await db
      .select({ displayName: propertiesTable.displayName, name: propertiesTable.name })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, propertyIdUsed))
      .limit(1);

    const fullName = `${foundProfile.firstName || ""} ${foundProfile.lastName || ""}`.trim() || foundProfile.fullName || `Staff #${targetEmployeeId}`;
    const residentPayload = {
      profileId: foundProfile.id,
      employeeId: foundProfile.profileId || String(foundProfile.id),
      fullName,
      department: foundProfile.department || "General",
      jobTitle: foundProfile.jobTitle || "Staff",
      photoUrl: foundProfile.photoUrl || null,
      nationalId: foundProfile.nationalId || "",
      roomNumber: roomInfo?.roomNumber || null,
      buildingName: buildingInfo?.name || null,
      bedNumber: activeAssignment?.bedNumber ? String(activeAssignment.bedNumber) : null,
      checkinDate: activeAssignment?.actualCheckinDate || activeAssignment?.startDate || null,
      propertyName: prop?.displayName || prop?.name || "Sunrise Staff Housing",
      propertyId: propertyIdUsed,
    };

    // Case A: Profile on Vacation
    if (foundProfile.status === "vacation") {
      res.json({
        success: true,
        verdict: "WARNING",
        statusCode: "VACATION",
        reason: "الموظف مسجل في إجازة رسمية / Resident is currently on vacation",
        resident: residentPayload,
      });
      return;
    }

    // Case B: No active assignment (checked out or unassigned)
    if (!activeAssignment || activeAssignment.status !== "ACTIVE") {
      res.json({
        success: true,
        verdict: "DENIED",
        statusCode: "NO_ACTIVE_HOUSING",
        reason: "لا يوجد تسكين نشط للموظف - تم إخلاء الغرفة أو غير مسكن / No active room assignment",
        resident: residentPayload,
      });
      return;
    }

    // Case C: Active Resident with valid room!
    res.json({
      success: true,
      verdict: "GRANTED",
      statusCode: "AUTHORIZED",
      reason: `مقيم نشط - غرفة ${roomInfo?.roomNumber || ""} (${buildingInfo?.name || ""})`,
      resident: residentPayload,
    });
  } catch (error: any) {
    console.error("[GateVerify] Error:", error);
    res.status(500).json({ error: error.message || "Failed to verify gate pass" });
  }
});

// ─── 3. POST /gate/log ─────────────────────────────────────────────────────
// Records resident entry/exit movement
router.post("/gate/log", requireAuth, async (req, res): Promise<void> => {
  try {
    const {
      propertyId: inputPropertyId,
      profileId,
      employeeId,
      fullName,
      department,
      jobTitle,
      roomNumber,
      buildingName,
      direction = "IN",
      status = "GRANTED",
      reason,
      scanMethod = "QR_SCAN",
      notes,
    } = req.body;

    if (!employeeId || !fullName) {
      res.status(400).json({ error: "Missing required fields (employeeId, fullName)" });
      return;
    }

    const propertyId = inputPropertyId || getTenantId(req) || 1;
    const scannedBy = (req as any).user?.username || (req as any).user?.fullName || "Security Officer";

    // Insert into public.gate_logs
    const [newLog] = await db
      .insert(gateLogsTable)
      .values({
        propertyId,
        profileId: profileId ? Number(profileId) : null,
        employeeId: String(employeeId),
        fullName: String(fullName),
        department: department || null,
        jobTitle: jobTitle || null,
        roomNumber: roomNumber ? String(roomNumber) : null,
        buildingName: buildingName || null,
        direction: direction === "OUT" ? "OUT" : "IN",
        status: status === "DENIED" ? "DENIED" : (status === "WARNING" ? "WARNING" : "GRANTED"),
        reason: reason || null,
        scannedBy,
        scanMethod: scanMethod || "QR_SCAN",
        notes: notes || null,
      })
      .returning();

    // Also write to tenant schema if propertyId is available
    if (propertyId) {
      try {
        await withTenant(propertyId, async (tenantDb) => {
          await tenantDb.insert(gateLogsTable).values({
            propertyId,
            profileId: profileId ? Number(profileId) : null,
            employeeId: String(employeeId),
            fullName: String(fullName),
            department: department || null,
            jobTitle: jobTitle || null,
            roomNumber: roomNumber ? String(roomNumber) : null,
            buildingName: buildingName || null,
            direction: direction === "OUT" ? "OUT" : "IN",
            status: status === "DENIED" ? "DENIED" : (status === "WARNING" ? "WARNING" : "GRANTED"),
            reason: reason || null,
            scannedBy,
            scanMethod: scanMethod || "QR_SCAN",
            notes: notes || null,
          });
        });
      } catch (_) {}
    }

    // Audit log
    await logActivity({
      propertyId,
      username: scannedBy,
      userId: (req as any).user?.id,
      action: `GATE_${direction}_${status}`,
      actionType: status === "DENIED" ? "WARNING" : "INFO",
      module: "gate",
      severity: status === "DENIED" ? "warning" : "info",
      details: `${fullName} (${employeeId}) - Room ${roomNumber || "N/A"} - ${direction} [${status}]`,
      entityType: "gate_log",
      entityId: newLog.id,
      req,
    });

    res.json({ success: true, log: newLog });
  } catch (error: any) {
    console.error("[GateLog] Error recording log:", error);
    res.status(500).json({ error: error.message || "Failed to record gate log" });
  }
});

// ─── 4. GET /gate/logs ─────────────────────────────────────────────────────
// Paginated gate access logs with server-side filters
router.get("/gate/logs", requireAuth, async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const propertyId = req.query.propertyId && req.query.propertyId !== "all"
      ? Number(req.query.propertyId)
      : null;
    const direction = req.query.direction as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const date = req.query.date as string | undefined; // YYYY-MM-DD

    const conditions = [];

    if (propertyId) {
      conditions.push(eq(gateLogsTable.propertyId, propertyId));
    }
    if (direction && direction !== "all") {
      conditions.push(eq(gateLogsTable.direction, direction));
    }
    if (status && status !== "all") {
      conditions.push(eq(gateLogsTable.status, status));
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(gateLogsTable.fullName, s),
          ilike(gateLogsTable.employeeId, s),
          ilike(gateLogsTable.roomNumber, s),
          ilike(gateLogsTable.department, s),
          ilike(gateLogsTable.scannedBy, s)
        )
      );
    }
    if (date) {
      conditions.push(sql`DATE(${gateLogsTable.scannedAt} AT TIME ZONE 'UTC') = ${date}::date`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(gateLogsTable)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Get paginated items
    const logs = await db
      .select({
        id: gateLogsTable.id,
        propertyId: gateLogsTable.propertyId,
        profileId: gateLogsTable.profileId,
        employeeId: gateLogsTable.employeeId,
        fullName: gateLogsTable.fullName,
        department: gateLogsTable.department,
        jobTitle: gateLogsTable.jobTitle,
        roomNumber: gateLogsTable.roomNumber,
        buildingName: gateLogsTable.buildingName,
        direction: gateLogsTable.direction,
        status: gateLogsTable.status,
        reason: gateLogsTable.reason,
        scannedBy: gateLogsTable.scannedBy,
        scanMethod: gateLogsTable.scanMethod,
        notes: gateLogsTable.notes,
        scannedAt: gateLogsTable.scannedAt,
        propertyName: propertiesTable.displayName,
      })
      .from(gateLogsTable)
      .leftJoin(propertiesTable, eq(gateLogsTable.propertyId, propertiesTable.id))
      .where(whereClause)
      .orderBy(desc(gateLogsTable.scannedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[GateLogs] Error fetching logs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch gate logs" });
  }
});

// ─── 5. GET /gate/stats ────────────────────────────────────────────────────
// Real-time statistics for housing security desk
router.get("/gate/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const propertyId = req.query.propertyId && req.query.propertyId !== "all"
      ? Number(req.query.propertyId)
      : null;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const baseConditions = [sql`DATE(${gateLogsTable.scannedAt} AT TIME ZONE 'UTC') = ${date}::date`];
    if (propertyId) {
      baseConditions.push(eq(gateLogsTable.propertyId, propertyId));
    }

    const whereBase = and(...baseConditions);

    const [stats] = await db
      .select({
        todayEntries: sql<number>`cast(count(*) filter (where ${gateLogsTable.direction} = 'IN' and ${gateLogsTable.status} = 'GRANTED') as int)`,
        todayExits: sql<number>`cast(count(*) filter (where ${gateLogsTable.direction} = 'OUT' and ${gateLogsTable.status} = 'GRANTED') as int)`,
        todayDenied: sql<number>`cast(count(*) filter (where ${gateLogsTable.status} = 'DENIED') as int)`,
        totalScans: sql<number>`cast(count(*) as int)`,
      })
      .from(gateLogsTable)
      .where(whereBase);

    const entries = stats?.todayEntries || 0;
    const exits = stats?.todayExits || 0;
    const currentlyInside = Math.max(0, entries - exits);

    res.json({
      success: true,
      stats: {
        todayEntries: entries,
        todayExits: exits,
        currentlyInside,
        todayDenied: stats?.todayDenied || 0,
        totalScans: stats?.totalScans || 0,
        date,
      },
    });
  } catch (error: any) {
    console.error("[GateStats] Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch gate statistics" });
  }
});

export default router;
