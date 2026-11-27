import { reportPropertyCondition } from "../lib/report-property-scope.js";
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
  gateDevicesTable,
} from "@workspace/db";
import { eq, and, desc, sql, or, ilike } from "drizzle-orm";
import { getTenantId, su } from "../lib/request-utils.js";
import {
  loadAuthUser,
  requirePermission,
  requireAnyPermission,
  hasPermission,
} from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import {
  GateLogBody,
  GateLogsQuery,
  GateStatsQuery,
  GateVerifyBody,
  GateDeviceCreateBody,
  GateDeviceUpdateBody,
  GateDeviceEventBody,
  IdParams,
  ProfileCodeParams,
  CommonListQuery,
} from "../validation/schemas.js";
import { portalSession } from "./portal-auth/shared.js";
import { logActivity } from "../lib/activity-logger.js";
import { logger } from "../lib/logger.js";
import { generateDeviceKey, verifyDeviceKey } from "../lib/gate-devices.js";
import { broadcastToProperty } from "../lib/websocket.js";
import {
  decideGateAccess,
  normalizeDirection,
  parseZktecoAttlog,
  type NormalizedGateEvent,
  type GateDirection,
  type GateMethod,
} from "../lib/gate-access.js";

const router: Router = Router();
const GATE_SECRET =
  process.env.GATE_SECRET || "sunrise_gate_pass_super_secret_key_2026";

function generateSignature(
  profileId: number,
  employeeId: string,
  propertyId: number,
  roomNumber: string,
): string {
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

  // 1b. Native app / API fallback: restore session from X-Session-Id header
  const xSid = req.headers["x-session-id"] as string | undefined;
  if (xSid && req.sessionStore) {
    return req.sessionStore.get(xSid, async (err: any, storedSess: any) => {
      if (!err && storedSess?.portal) {
        req.session.portal = storedSess.portal;
        (req as any).portalUser = storedSess.portal;
        return next();
      }
      await checkAdminAuth();
    });
  }

  await checkAdminAuth();

  async function checkAdminAuth() {
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
  }
};

// ─── 1. GET /gate/pass/:profileId ──────────────────────────────────────────
// Generates official scannable Gate Pass with real QR Code
router.get(
  "/gate/pass/:profileId",
  allowAdminOrPortalAuth,
  validate({ params: ProfileCodeParams, query: CommonListQuery }),
  async (req, res): Promise<void> => {
    try {
      const pSess = portalSession(req) || (req as any).portalUser;
      const rawPropertyId = req.query.propertyId
        ? Number(req.query.propertyId)
        : pSess?.propertyId || getTenantId(req);
      const rawParam = String(req.params.profileId).trim();
      let profileIdNum: number | null = null;
      let employeeCodeStr: string | null = null;

      if (rawParam === "me") {
        if (!pSess?.profileDbId) {
          res
            .status(400)
            .json({ error: "Profile not found in portal session" });
          return;
        }
        profileIdNum = pSess.profileDbId;
      } else {
        const parsedNum = Number(rawParam);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          profileIdNum = parsedNum;
        } else {
          employeeCodeStr = rawParam;
        }
      }

      // RBAC & IDOR protection:
      if (!pSess && (req.session as any)?.userId) {
        // Admin session: verify gate.view or profiles.view permission
        const authUser = await loadAuthUser(req, res);
        if (
          !authUser ||
          (!authUser.isSystemAdmin &&
            !hasPermission(authUser, "gate", "view") &&
            !hasPermission(authUser, "profiles", "view"))
        ) {
          res.status(403).json({
            error: "Permission denied. Requires gate.view or profiles.view",
          });
          return;
        }
      } else if (pSess && !(req.session as any)?.userId) {
        // Resident portal: only allowed to view own gate pass
        const isOwner = profileIdNum
          ? profileIdNum === pSess.profileDbId
          : employeeCodeStr === pSess.clockNumber;
        if (rawParam !== "me" && !isOwner) {
          res.status(403).json({
            error: "Access denied. You can only view your own gate pass.",
          });
          return;
        }
      }

      // Try finding the profile in tenant schema or public
      let profile: any = null;
      let activeAssignment: any = null;
      let roomInfo: any = null;
      let buildingInfo: any = null;
      let propertyId = rawPropertyId || pSess?.propertyId || 1;

      // Helper to query within a tenant
      const loadProfileData = async (tenantDb: any, propId: number) => {
        let query = tenantDb.select().from(profilesTable);
        if (profileIdNum) {
          query = query.where(eq(profilesTable.id, profileIdNum));
        } else if (employeeCodeStr) {
          query = query.where(
            or(
              eq(profilesTable.profileId, employeeCodeStr),
              eq(profilesTable.nationalId, employeeCodeStr),
            ),
          );
        }
        const [p] = await query.limit(1);

        if (!p) return null;

        // Find active assignment
        const [assign] = await tenantDb
          .select()
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.profileId, p.id),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
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

        return {
          profile: p,
          assignment: assign,
          room: r,
          building: b,
          propertyId: propId,
        };
      };

      if (propertyId) {
        try {
          const data = await withTenant(propertyId, (tdb) =>
            loadProfileData(tdb, propertyId),
          );
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
        const { rows: allProps } = await db.execute(
          sql`SELECT id FROM public.properties WHERE is_active = true`,
        );
        for (const pr of allProps) {
          try {
            const prId = Number((pr as any).id);
            const data: any = await withTenant(prId, (tdb) =>
              loadProfileData(tdb, prId),
            );
            if (data) {
              profile = data.profile;
              activeAssignment = data.assignment;
              roomInfo = data.room;
              buildingInfo = data.building;
              propertyId = prId;
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
        .select({
          id: propertiesTable.id,
          name: propertiesTable.name,
          displayName: propertiesTable.displayName,
        })
        .from(propertiesTable)
        .where(eq(propertiesTable.id, propertyId))
        .limit(1);

      const employeeId = String(profile.profileId || profile.id);
      const roomNumber = roomInfo?.roomNumber || "UNASSIGNED";
      const buildingName = buildingInfo?.name || "Main Campus";
      const bedNumber = activeAssignment?.bedNumber
        ? String(activeAssignment.bedNumber)
        : "1";
      const isAssigned = Boolean(
        activeAssignment && activeAssignment.status === "ACTIVE",
      );

      // Generate security HMAC token
      const signature = generateSignature(
        profile.id,
        employeeId,
        propertyId,
        roomNumber,
      );

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

      const fullName =
        `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
        profile.fullName ||
        `Staff #${employeeId}`;

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
            status: isAssigned
              ? "ACTIVE"
              : profile.status === "vacation"
                ? "VACATION"
                : "UNASSIGNED",
            roomNumber,
            buildingName,
            floorNumber: roomInfo?.floorId || 1,
            bedNumber,
            checkinDate:
              activeAssignment?.actualCheckinDate ||
              activeAssignment?.startDate ||
              profile.hireDate ||
              null,
          },
          property: {
            id: propertyId,
            name:
              property?.displayName ||
              property?.name ||
              "Sunrise Staff Housing",
          },
          qrPayload,
          qrDataUrl,
          signature,
          issuedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error({ err: error }, "[GatePass] Error generating pass");
      res
        .status(500)
        .json({ error: error.message || "Failed to generate gate pass" });
    }
  },
);

// ─── 2. POST /gate/verify ──────────────────────────────────────────────────
// Security verification at the electronic gate (Camera scanner / barcode gun)
router.post(
  "/gate/verify",
  requirePermission("gate", "create"),
  validate({ body: GateVerifyBody }),
  async (req, res): Promise<void> => {
    try {
      const {
        qrPayload,
        employeeId: inputEmpId,
        propertyId: inputPropId,
      } = req.body;

      let targetEmployeeId = inputEmpId ? String(inputEmpId).trim() : "";
      let targetProfileId: number | null = null;
      let targetPropertyId = inputPropId
        ? Number(inputPropId)
        : getTenantId(req) || 1;

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
            if (part.startsWith("E") && !part.startsWith("EXP"))
              targetEmployeeId = part.slice(1);
            if (part.startsWith("PID")) targetProfileId = Number(part.slice(3));
            if (part.startsWith("P") && !part.startsWith("PID"))
              targetPropertyId = Number(part.slice(1));
          }
        }
      }

      if (!targetEmployeeId && !targetProfileId) {
        res.status(400).json({
          success: false,
          verdict: "DENIED",
          reason:
            "لم يتم التعرف على كود الموظف أو رمز الـ QR / Invalid QR payload",
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
              eq(profilesTable.nationalId, targetEmployeeId),
            ),
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
              eq(assignmentsTable.status, "ACTIVE"),
            ),
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

        return {
          profile: p,
          assignment: assign,
          room: r,
          building: b,
          propertyId: pId,
        };
      };

      // 1. Try target property
      try {
        const data = await withTenant(propertyIdUsed, (tdb) =>
          findResidentInTenant(tdb, propertyIdUsed),
        );
        if (data) {
          foundProfile = data.profile;
          activeAssignment = data.assignment;
          roomInfo = data.room;
          buildingInfo = data.building;
        }
      } catch (_) {}

      // 2. If not found, search other active properties
      if (!foundProfile) {
        const { rows: allProps } = await db.execute(
          sql`SELECT id FROM public.properties WHERE is_active = true`,
        );
        for (const pr of allProps) {
          const prId = Number((pr as any).id);
          if (prId === propertyIdUsed) continue;
          try {
            const data: any = await withTenant(prId, (tdb) =>
              findResidentInTenant(tdb, prId),
            );
            if (data) {
              foundProfile = data.profile;
              activeAssignment = data.assignment;
              roomInfo = data.room;
              buildingInfo = data.building;
              propertyIdUsed = prId;
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
          reason:
            "الموظف غير مسجل بنظام السكن / Resident not found in housing records",
          employeeId: targetEmployeeId,
        });
        return;
      }

      const [prop] = await db
        .select({
          displayName: propertiesTable.displayName,
          name: propertiesTable.name,
        })
        .from(propertiesTable)
        .where(eq(propertiesTable.id, propertyIdUsed))
        .limit(1);

      const fullName =
        `${foundProfile.firstName || ""} ${foundProfile.lastName || ""}`.trim() ||
        foundProfile.fullName ||
        `Staff #${targetEmployeeId}`;
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
        bedNumber: activeAssignment?.bedNumber
          ? String(activeAssignment.bedNumber)
          : null,
        checkinDate:
          activeAssignment?.actualCheckinDate ||
          activeAssignment?.startDate ||
          null,
        propertyName:
          prop?.displayName || prop?.name || "Sunrise Staff Housing",
        propertyId: propertyIdUsed,
      };

      // Case A: Profile on Vacation
      if (foundProfile.status === "vacation") {
        res.json({
          success: true,
          verdict: "WARNING",
          statusCode: "VACATION",
          reason:
            "الموظف مسجل في إجازة رسمية / Resident is currently on vacation",
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
          reason:
            "لا يوجد تسكين نشط للموظف - تم إخلاء الغرفة أو غير مسكن / No active room assignment",
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
      logger.error({ err: error }, "[GateVerify] Error");
      res
        .status(500)
        .json({ error: error.message || "Failed to verify gate pass" });
    }
  },
);

// ─── 3. POST /gate/log ─────────────────────────────────────────────────────
// Records resident entry/exit movement
router.post(
  "/gate/log",
  requirePermission("gate", "create"),
  validate({ body: GateLogBody }),
  async (req, res): Promise<void> => {
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
        res
          .status(400)
          .json({ error: "Missing required fields (employeeId, fullName)" });
        return;
      }

      const propertyId = inputPropertyId || getTenantId(req) || 1;
      const scannedBy =
        (req as any).user?.username ||
        (req as any).user?.fullName ||
        "Security Officer";

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
          status:
            status === "DENIED"
              ? "DENIED"
              : status === "WARNING"
                ? "WARNING"
                : "GRANTED",
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
              status:
                status === "DENIED"
                  ? "DENIED"
                  : status === "WARNING"
                    ? "WARNING"
                    : "GRANTED",
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
      logger.error({ err: error }, "[GateLog] Error recording log");
      res
        .status(500)
        .json({ error: error.message || "Failed to record gate log" });
    }
  },
);

// ─── 4. GET /gate/logs ─────────────────────────────────────────────────────
// Paginated gate access logs with server-side filters
router.get(
  "/gate/logs",
  requirePermission("gate", "view"),
  validate({ query: GateLogsQuery }),
  async (req, res): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      // Limited to the properties this user may read (also for "all").
      const propertyScope = reportPropertyCondition(
        req,
        gateLogsTable.propertyId,
      );
      const direction = req.query.direction as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const date = req.query.date as string | undefined; // YYYY-MM-DD

      const conditions = [];

      if (propertyScope) conditions.push(propertyScope);
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
            ilike(gateLogsTable.scannedBy, s),
          ),
        );
      }
      if (date) {
        conditions.push(
          sql`DATE(${gateLogsTable.scannedAt} AT TIME ZONE 'UTC') = ${date}::date`,
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

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
        .leftJoin(
          propertiesTable,
          eq(gateLogsTable.propertyId, propertiesTable.id),
        )
        .where(whereClause)
        .orderBy(desc(gateLogsTable.scannedAt), desc(gateLogsTable.id))
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
      logger.error({ err: error }, "[GateLogs] Error fetching logs");
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch gate logs" });
    }
  },
);

// ─── 5. GET /gate/stats ────────────────────────────────────────────────────
// Real-time statistics for housing security desk
router.get(
  "/gate/stats",
  requirePermission("gate", "view"),
  validate({ query: GateStatsQuery }),
  async (req, res): Promise<void> => {
    try {
      const propertyScope = reportPropertyCondition(
        req,
        gateLogsTable.propertyId,
      );
      const date =
        (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const baseConditions = [
        sql`DATE(${gateLogsTable.scannedAt} AT TIME ZONE 'UTC') = ${date}::date`,
      ];
      if (propertyScope) baseConditions.push(propertyScope);

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
      logger.error({ err: error }, "[GateStats] Error");
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch gate statistics" });
    }
  },
);

// ─── 6. POST /gate/device/event ────────────────────────────────────────────
// Universal ingestion endpoint for physical access devices (biometric
// terminals, card readers, turnstile controllers). The device authenticates
// with its API key (x-device-key); the server resolves the resident, decides
// GRANT/DENY, logs the IN/OUT movement and returns whether to open the gate.
//
// Accepts either a normalized event ({ userRef, direction, method }) from any
// modern system (Hikvision ISAPI, Suprema, a custom bridge), or a raw ZKTeco
// ATTLOG upload ({ format: "zkteco_attlog", data }).
async function resolveResidentForGate(
  tenantDb: any,
  userRef: string,
): Promise<{ profile: any; assignment: any; room: any; building: any } | null> {
  const [p] = await tenantDb
    .select()
    .from(profilesTable)
    .where(
      or(
        eq(profilesTable.profileId, userRef),
        eq(profilesTable.nationalId, userRef),
        sql`CAST(${profilesTable.id} AS TEXT) = ${userRef}`,
      ),
    )
    .limit(1);
  if (!p) return null;
  const [assign] = await tenantDb
    .select()
    .from(assignmentsTable)
    .where(
      and(
        eq(assignmentsTable.profileId, p.id),
        eq(assignmentsTable.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(assignmentsTable.id))
    .limit(1);
  let room = null;
  let building = null;
  if (assign?.roomId) {
    const [rm] = await tenantDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assign.roomId))
      .limit(1);
    room = rm;
    if (rm?.buildingId) {
      const [bld] = await tenantDb
        .select()
        .from(buildingsTable)
        .where(eq(buildingsTable.id, rm.buildingId))
        .limit(1);
      building = bld;
    }
  }
  return { profile: p, assignment: assign, room, building };
}

router.post(
  "/gate/device/event",
  validate({ body: GateDeviceEventBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId =
        Number(req.query?.propertyId) || Number((req.body as any)?.propertyId);
      if (!propertyId) {
        res.status(400).json({ success: false, error: "propertyId required" });
        return;
      }
      const presentedKey = String(req.headers["x-device-key"] || "").trim();
      if (!presentedKey) {
        res.status(401).json({ success: false, error: "Missing x-device-key" });
        return;
      }

      const b = req.body as any;

      // Authenticate the device within the property (by serial if given, else
      // by matching the key against the property's enabled devices).
      const device = await withTenant(propertyId, async (tdb) => {
        const rows = await tdb
          .select()
          .from(gateDevicesTable)
          .where(eq(gateDevicesTable.enabled, true));
        const candidates = b.serial
          ? rows.filter((d: any) => d.serialNumber === b.serial)
          : rows;
        return (
          candidates.find((d: any) =>
            verifyDeviceKey(presentedKey, d.apiKeyHash),
          ) || null
        );
      });

      if (!device) {
        logger.warn("[GATE_DEVICE_AUTH_FAIL] invalid x-device-key");
        res.status(401).json({ success: false, error: "Unauthorized device" });
        return;
      }

      // Mark the device as seen.
      await withTenant(propertyId, (tdb) =>
        tdb
          .update(gateDevicesTable)
          .set({ lastSeenAt: new Date() })
          .where(eq(gateDevicesTable.id, device.id)),
      );

      const deviceDefaultDir: GateDirection =
        device.direction === "OUT" ? "OUT" : "IN";

      // Build the list of normalized events to process.
      let events: NormalizedGateEvent[];
      if (b.format === "zkteco_attlog" && b.data) {
        events = parseZktecoAttlog(b.data, {
          defaultDirection: deviceDefaultDir,
        });
      } else {
        events = [
          {
            userRef: String(b.userRef),
            direction: b.direction
              ? normalizeDirection(b.direction, deviceDefaultDir)
              : deviceDefaultDir,
            method: (String(b.method || "FINGERPRINT").toUpperCase() ||
              "FINGERPRINT") as GateMethod,
          },
        ];
      }

      const results: any[] = [];
      for (const ev of events) {
        const dir: GateDirection =
          device.direction === "BOTH" ? ev.direction : deviceDefaultDir;
        const resolved = await withTenant(propertyId, (tdb) =>
          resolveResidentForGate(tdb, ev.userRef),
        );
        const decision = decideGateAccess({
          profile: resolved?.profile ?? null,
          hasActiveAssignment: Boolean(resolved?.assignment),
        });

        const p = resolved?.profile;
        await withTenant(propertyId, (tdb) =>
          tdb.insert(gateLogsTable).values({
            propertyId,
            profileId: p?.id ?? null,
            employeeId: p?.profileId ?? ev.userRef,
            fullName: p?.fullName ?? p?.name ?? ev.userRef,
            department: p?.department ?? null,
            jobTitle: p?.jobTitle ?? null,
            roomNumber: resolved?.room?.roomNumber ?? null,
            buildingName: resolved?.building?.name ?? null,
            direction: dir,
            status: decision.status,
            reason: decision.reason,
            scannedBy: device.name,
            scanMethod: ev.method,
          }),
        );

        results.push({
          userRef: ev.userRef,
          direction: dir,
          method: ev.method,
          decision: decision.decision,
          open: decision.decision === "GRANT",
          reason: decision.reason,
          resident: p
            ? {
                profileId: p.id,
                employeeId: p.profileId,
                name: p.fullName ?? p.name,
                room: resolved?.room?.roomNumber ?? null,
                building: resolved?.building?.name ?? null,
              }
            : null,
        });
      }

      broadcastToProperty(propertyId, { module: "gate", action: "sync" });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

      // Single-event callers (the common case) get a flat response; batch
      // (ATTLOG) callers get the full list.
      if (results.length === 1) {
        res.json({ success: true, ...results[0], processed: 1 });
      } else {
        res.json({ success: true, processed: results.length, results });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// ─── 7. Gate devices registry (biometric terminals / turnstiles) ───────────
// The API key is returned once, on creation / rotation. The stored hash is
// never exposed.
function shapeDevice(d: any) {
  if (!d) return d;
  const { apiKeyHash, ...rest } = d;
  void apiKeyHash;
  return rest;
}

// GET /gate/devices — list the property's registered devices
router.get(
  "/gate/devices",
  requireAnyPermission(["gate", "view"], ["settings", "view"]),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }
      const rows = await withTenant(propertyId, (tdb) =>
        tdb.select().from(gateDevicesTable).orderBy(desc(gateDevicesTable.id)),
      );
      res.json({ success: true, data: rows.map(shapeDevice) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /gate/devices — register a device and mint its API key (shown once)
router.post(
  "/gate/devices",
  requireAnyPermission(["gate", "create"], ["settings", "edit"]),
  validate({ body: GateDeviceCreateBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }
      const b = req.body as any;
      const { key, hash, prefix } = generateDeviceKey();

      const [created] = await withTenant(propertyId, (tdb) =>
        tdb
          .insert(gateDevicesTable)
          .values({
            propertyId,
            name: b.name,
            deviceType: b.deviceType ?? "BIOMETRIC",
            vendor: b.vendor ?? "GENERIC",
            serialNumber: b.serialNumber ?? null,
            ipAddress: b.ipAddress ?? null,
            port: b.port ?? null,
            direction: b.direction ?? "IN",
            apiKeyHash: hash,
            apiKeyPrefix: prefix,
            enabled: b.enabled ?? true,
          })
          .returning(),
      );

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تسجيل جهاز بوابة: ${created.name}`,
        actionType: "CREATE",
        module: "gate",
        entityType: "gate_device",
        entityId: created.id,
        details: { name: created.name, vendor: created.vendor },
      });

      // The raw key is returned ONCE here and never stored or shown again.
      res
        .status(201)
        .json({ success: true, data: shapeDevice(created), apiKey: key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PATCH /gate/devices/:id — update a device; rotateKey mints a new key (once)
router.patch(
  "/gate/devices/:id",
  requireAnyPermission(["gate", "create"], ["settings", "edit"]),
  validate({ params: IdParams }),
  validate({ body: GateDeviceUpdateBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const id = Number(req.params.id);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }
      const b = req.body as any;
      const set: Record<string, any> = { updatedAt: new Date() };
      for (const f of [
        "name",
        "deviceType",
        "vendor",
        "serialNumber",
        "ipAddress",
        "port",
        "direction",
        "enabled",
      ]) {
        if (Object.prototype.hasOwnProperty.call(b, f)) set[f] = b[f];
      }

      let newKey: string | undefined;
      if (b.rotateKey) {
        const { key, hash, prefix } = generateDeviceKey();
        set.apiKeyHash = hash;
        set.apiKeyPrefix = prefix;
        newKey = key;
      }

      const [updated] = await withTenant(propertyId, (tdb) =>
        tdb
          .update(gateDevicesTable)
          .set(set)
          .where(eq(gateDevicesTable.id, id))
          .returning(),
      );
      if (!updated) {
        res.status(404).json({ error: "Device not found" });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تعديل جهاز بوابة: ${updated.name}${b.rotateKey ? " (تدوير المفتاح)" : ""}`,
        actionType: "UPDATE",
        module: "gate",
        entityType: "gate_device",
        entityId: updated.id,
        details: { rotateKey: Boolean(b.rotateKey) },
      });

      res.json({ success: true, data: shapeDevice(updated), apiKey: newKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /gate/devices/:id — remove a device
router.delete(
  "/gate/devices/:id",
  requireAnyPermission(["gate", "create"], ["settings", "edit"]),
  validate({ params: IdParams }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const id = Number(req.params.id);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }
      const [removed] = await withTenant(propertyId, (tdb) =>
        tdb
          .delete(gateDevicesTable)
          .where(eq(gateDevicesTable.id, id))
          .returning(),
      );
      if (!removed) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف جهاز بوابة: ${removed.name}`,
        actionType: "DELETE",
        module: "gate",
        entityType: "gate_device",
        entityId: removed.id,
        severity: "warning",
        details: { name: removed.name },
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
