import { Router } from "express";
import { db, withTenant, reservationsTable, roomsTable, assignmentsTable, profilesTable } from "@workspace/db";
import { eq, and, sql, SQL, desc, ilike } from "drizzle-orm";
import {
  CreateReservationBody,
  UpdateReservationBody,
  GetReservationParams,
  UpdateReservationParams,
  DeleteReservationParams,
  CheckinReservationParams,
  CheckinReservationBody,
  ListReservationsQueryParams,
  ListReservationsResponse,
  GetReservationResponse,
  UpdateReservationResponse,
  CheckinReservationResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();

function toCamel(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const dateFields = [
      "checkInDate",
      "checkOutDate",
      "actualCheckInDate",
      "actualCheckOutDate",
      "createdAt",
      "updatedAt",
    ];
    if (v instanceof Date) out[camel] = v.toISOString();
    else if (dateFields.includes(camel) && v == null) out[camel] = null;
    else out[camel] = v;
  }
  return out;
}

function fmtReservation(r: Record<string, any>) {
  if (!r) return r;
  return toCamel(r);
}

function cleanText(value: unknown, max = 250): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

router.get(
  "/reservations",
  requirePermission("reservations", "view"),
  async (req, res) => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListReservationsQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 25),
    );
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    if (query.success) {
      if (query.data.status)
        conditions.push(eq(reservationsTable.status, query.data.status));
    }
    
    if (search.trim()) {
      conditions.push(
        sql`(${reservationsTable.firstName} ILIKE ${`%${search}%`} OR ${reservationsTable.lastName} ILIKE ${`%${search}%`} OR ${reservationsTable.guestIdCardNumber} ILIKE ${`%${search}%`})`
      );
    }

    const { data, total } = await withTenant(propertyId, async (tenantDb) => {
      let countQuery = tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(reservationsTable) as any;
      if (conditions.length > 0)
        countQuery = countQuery.where(and(...conditions));
      const countResult = await countQuery;
      const totalCount = Number(countResult[0]?.count ?? 0);

      let baseQuery = tenantDb
        .select()
        .from(reservationsTable)
        .orderBy(desc(reservationsTable.createdAt))
        .limit(limit)
        .offset(offset) as any;
      if (conditions.length > 0)
        baseQuery = baseQuery.where(and(...conditions));

      const rows = await baseQuery;
      return { data: rows, total: totalCount };
    });

    res.json({
      data: data.map((r: any) => fmtReservation({ ...r, propertyId })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  },
);

router.post(
  "/reservations",
  requirePermission("reservations", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateReservationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const body = req.body as any;

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const nat = cleanText(body.nationality, 120);
        const gen = cleanText(body.gender, 20);
        const code = cleanText(body.profileCode, 80);
        const lvl = cleanText(body.level, 80);
        const fn = cleanText(body.firstName, 120);
        const ln = cleanText(body.lastName, 120);
        const phone = cleanText(body.guestPhone, 80);
        const idNum = cleanText(body.guestIdCardNumber, 120);
        const dept = cleanText(body.department, 120);
        const jt = cleanText(body.jobTitle, 120);
        const rt = cleanText(body.roomType, 80);
        const notes = cleanText(body.notes, 2000);

        const rId = body.roomId ? parseInt(body.roomId) : null;
        const bedNum = body.bedNumber ? String(body.bedNumber) : null;
        let finalNotes = notes;
        if (bedNum === "ALL") {
          finalNotes = `[حجز الغرفة بالكامل] ${finalNotes}`.trim();
        } else if (bedNum) {
          finalNotes = `[سرير رقم: ${bedNum}] ${finalNotes}`.trim();
        }

        const insertRes = (await tenantDb.execute(sql`
        INSERT INTO reservations
          (room_id, first_name, last_name, room_type, check_in_date, check_out_date,
           notes, guest_id_card_number, guest_phone, job_title, department,
           status, nationality, gender, profile_code, level)
        VALUES
          (${rId}, ${fn}, ${ln}, ${rt}, ${body.checkInDate ?? null}, ${body.checkOutDate ?? null},
           ${finalNotes}, ${idNum}, ${phone}, ${jt}, ${dept},
           'UPCOMING', ${nat}, ${gen}, ${code}, ${lvl})
        RETURNING *
      `)) as any;
        const rows = Array.isArray(insertRes)
          ? insertRes
          : (insertRes?.rows ?? []);
        return rows[0] ? toCamel(rows[0]) : null;
      });

      if (!result) {
        res.status(500).json({ error: "Insert failed" });
        return;
      }

      const guestFullName =
        `${result.firstName ?? ""} ${result.lastName ?? ""}`.trim() || "Guest";
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حجز جديد للضيف: ${guestFullName}`,
        actionType: "CREATE",
        module: "reservations",
        entityType: "reservation",
        entityId: result.id,
        details: `Check-in: ${result.checkInDate}, Check-out: ${result.checkOutDate}`,
      });
      broadcastToProperty(propertyId, {
        module: "reservations",
        action: "created",
        entityId: result.id,
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      res.status(201).json({ ...result, propertyId });
    } catch (err: any) {
      console.error("[POST /reservations] error:", err?.message ?? err);
      res.status(500).json({ error: "Failed to create reservation" });
    }
  },
);

router.get(
  "/reservations/:id",
  requirePermission("reservations", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const params = GetReservationParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [reservation] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(reservationsTable)
          .where(eq(reservationsTable.id, params.data.id));
      });

      if (!reservation) {
        res.status(404).json({ error: "Reservation not found" });
        return;
      }
      res.json({
        ...fmtReservation(reservation),
        propertyId,
      });
    } catch (err: any) {
      console.error("[GET /reservations/:id] error:", err?.message ?? err);
      res.status(500).json({ error: "Failed to fetch reservation" });
    }
  },
);

router.patch(
  "/reservations/:id",
  requirePermission("reservations", "edit"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const params = UpdateReservationParams.safeParse(req.params);
      const parsed = UpdateReservationBody.safeParse(req.body);
      if (!params.success || !parsed.success) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(reservationsTable)
          .set(parsed.data as any)
          .where(eq(reservationsTable.id, params.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Reservation not found" });
        return;
      }
      broadcastToProperty(propertyId, {
        module: "reservations",
        action: "updated",
        entityId: updated.id,
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      res.json({
        ...fmtReservation(updated),
        propertyId,
      });
    } catch (err: any) {
      console.error("[PATCH /reservations/:id] error:", err?.message ?? err);
      res.status(500).json({ error: "Failed to update reservation" });
    }
  },
);

router.delete(
  "/reservations/:id",
  requirePermission("reservations", "delete"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const params = DeleteReservationParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const existing = await withTenant(propertyId, async (tenantDb) => {
        const [r] = await tenantDb
          .select()
          .from(reservationsTable)
          .where(eq(reservationsTable.id, params.data.id));
        if (r)
          await tenantDb
            .delete(reservationsTable)
            .where(eq(reservationsTable.id, params.data.id));
        return r;
      });

      if (existing) {
        const s = su(req);
        await logActivity({
          req,
          propertyId,
          username: s.username,
          userId: s.userId,
          userRole: s.userRole,
          action: `حذف حجز الضيف: ${(existing as any).guestName ?? existing.firstName}`,
          actionType: "DELETE",
          module: "reservations",
          entityType: "reservation",
          entityId: existing.id,
          severity: "warning",
        });
        broadcastToProperty(propertyId, {
          module: "reservations",
          action: "deleted",
          entityId: existing.id,
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      }
      res.sendStatus(204);
    } catch (err: any) {
      console.error("[DELETE /reservations/:id] error:", err?.message ?? err);
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  },
);

router.post(
  "/reservations/:id/checkin",
  requirePermission("reservations", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = CheckinReservationParams.safeParse(req.params);
    const parsed = CheckinReservationBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    try {
      const resId = params.data.id;
      const roomId = parsed.data.roomId;
      const cin = parsed.data.actualCheckInDate ?? new Date().toISOString();

      const result = await withTenant(propertyId, async (tenantDb) => {
        const [current] = await tenantDb
          .select()
          .from(reservationsTable)
          .where(eq(reservationsTable.id, resId))
          .limit(1);

        if (!current) return { notFound: true } as const;
        if (current.status !== "UPCOMING") {
          return { conflict: true, status: current.status } as const;
        }

        const [room] = await tenantDb
          .select({
            id: roomsTable.id,
            roomNumber: roomsTable.roomNumber,
            currentOccupancy: roomsTable.currentOccupancy,
            capacity: roomsTable.capacity,
          })
          .from(roomsTable)
          .where(eq(roomsTable.id, roomId))
          .limit(1);

        if (!room) return { roomNotFound: true } as const;
        if (room.currentOccupancy >= room.capacity) {
          return { roomFull: true, capacity: room.capacity } as const;
        }

        // 1. Find or create profile
        let profile: any = null;
        const pCode = (current as any).profileCode;
        if (pCode) {
          const [p] = await tenantDb
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.profileId, pCode))
            .limit(1);
          if (p) profile = p;
        }
        if (!profile && current.guestIdCardNumber) {
          const [p] = await tenantDb
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.nationalId, current.guestIdCardNumber))
            .limit(1);
          if (p) profile = p;
        }
        if (!profile && current.firstName && current.lastName) {
          const [p] = await tenantDb
            .select()
            .from(profilesTable)
            .where(
              and(
                ilike(profilesTable.firstName, current.firstName.trim()),
                ilike(profilesTable.lastName, current.lastName.trim()),
              ),
            )
            .limit(1);
          if (p) profile = p;
        }

        // 2. Prevent checking in if the person is ALREADY actively residing in another room!
        if (profile) {
          const [activeAssignment] = await tenantDb
            .select({
              id: assignmentsTable.id,
              roomId: assignmentsTable.roomId,
              roomNumber: roomsTable.roomNumber,
            })
            .from(assignmentsTable)
            .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
            .where(
              and(
                eq(assignmentsTable.profileId, profile.id),
                eq(assignmentsTable.status, "ACTIVE"),
              ),
            )
            .limit(1);

          if (activeAssignment) {
            return {
              alreadyAssigned: true,
              profileName: `${profile.firstName} ${profile.lastName}`,
              roomNumber: activeAssignment.roomNumber ?? activeAssignment.roomId,
            } as const;
          }
        }

        // 3. Create profile if it didn't exist
        if (!profile) {
          const newProfileId = pCode || `GUEST-${Date.now().toString().slice(-5)}`;
          const [created] = await tenantDb
            .insert(profilesTable)
            .values({
              profileId: newProfileId,
              firstName: current.firstName.trim(),
              lastName: current.lastName.trim(),
              nationalId: current.guestIdCardNumber || "",
              phone: current.guestPhone || "",
              department: current.department || "",
              jobTitle: current.jobTitle || "",
              nationality: (current as any).nationality || "",
              gender: (current as any).gender || "M",
              status: "ACTIVE",
            } as any)
            .returning();
          profile = created;
        } else {
          await tenantDb
            .update(profilesTable)
            .set({ status: "ACTIVE" })
            .where(eq(profilesTable.id, profile.id));
        }

        const isEntireRoom = current.notes?.includes("[حجز الغرفة بالكامل]");
        const bedMatch = current.notes?.match(/\[سرير رقم:?\s*(\d+)\]/);
        const parsedBed = bedMatch ? parseInt(bedMatch[1]) : null;

        const newOccupancy = isEntireRoom ? room.capacity : Math.min(room.capacity, room.currentOccupancy + 1);

        // 4. Update room occupancy
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: newOccupancy,
            status: newOccupancy >= room.capacity ? "occupied" : "available",
          })
          .where(eq(roomsTable.id, roomId));

        // 5. Create ACTIVE assignment in assignmentsTable (So he appears in In-House!)
        const [assignment] = await tenantDb
          .insert(assignmentsTable)
          .values({
            profileId: profile.id,
            roomId: roomId,
            bedNumber: isEntireRoom ? null : parsedBed,
            checkInDate: String(cin),
            expectedCheckOutDate: current.checkOutDate || null,
            status: "ACTIVE",
            notes: `حجز رقم #${current.id}${current.notes ? ` - ${current.notes}` : ""}`,
          })
          .returning();

        // 6. Update reservation status to CHECKED_IN
        const [updated] = await tenantDb
          .update(reservationsTable)
          .set({ status: "CHECKED_IN", roomId, checkInDate: String(cin) })
          .where(eq(reservationsTable.id, resId))
          .returning();

        return { data: updated, assignment, profile, room } as const;
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "Reservation not found" });
        return;
      }
      if ("conflict" in result) {
        res.status(409).json({
          error: `Cannot check in: reservation is "${result.status}", expected "UPCOMING"`,
        });
        return;
      }
      if ("roomNotFound" in result) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      if ("roomFull" in result) {
        res.status(409).json({
          error: `Room is full (capacity ${result.capacity})`,
        });
        return;
      }
      if ("alreadyAssigned" in result) {
        res.status(409).json({
          error: `الموظف (${result.profileName}) مسكّن بالفعل في الغرفة #${result.roomNumber}. لا يمكن تسكينه مرتين دون تسجيل خروجه أولاً أو عمل روم موف.`,
          code: "PROFILE_ALREADY_ASSIGNED",
        });
        return;
      }

      const updated = result.data;
      const s = su(req);
      const guestName =
        `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim() ||
        "Guest";
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تسجيل وصول الضيف: ${guestName} في غرفة ${result.room.roomNumber}`,
        actionType: "CHECKIN",
        module: "reservations",
        entityType: "reservation",
        entityId: updated.id,
        details: `Room: ${roomId}`,
      });

      broadcastToProperty(propertyId, {
        module: "reservations",
        action: "checkin",
        entityId: updated.id,
      });
      broadcastToProperty(propertyId, {
        module: "assignments",
        action: "created",
        entityId: result.assignment.id,
      });
      broadcastToProperty(propertyId, {
        module: "accommodation",
        action: "created",
        entityId: result.assignment.id,
      });
      broadcastToProperty(propertyId, {
        module: "rooms",
        action: "updated",
        entityId: roomId,
      });
      broadcastToProperty(propertyId, {
        module: "housing",
        action: "updated",
        entityId: roomId,
      });
      broadcastToProperty(propertyId, {
        module: "profiles",
        action: "updated",
        entityId: result.profile.id,
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

      res.status(201).json({
        ...updated,
        propertyId,
        assignment: result.assignment,
        profile: result.profile,
        room: result.room,
      });
    } catch (err: any) {
      console.error(
        "[POST /reservations/:id/checkin] error:",
        err?.message ?? err,
      );
      res.status(500).json({ error: "Check-in failed" });
    }
  },
);

router.patch(
  "/reservations/:id/checkout",
  requirePermission("reservations", "edit"),
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

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [reservation] = await tenantDb
        .select()
        .from(reservationsTable)
        .where(eq(reservationsTable.id, id));
      if (!reservation)
        return { error: "Reservation not found", status: 404 } as const;
      if (reservation.status !== "CHECKED_IN")
        return {
          error: "Reservation is not checked in",
          status: 409,
          currentStatus: reservation.status,
        } as const;

      const checkOutDate =
        (req.body as any).checkOutDate || new Date().toISOString();

      // Decrement room occupancy
      if (reservation.roomId) {
        const [room] = await tenantDb
          .select({ currentOccupancy: roomsTable.currentOccupancy })
          .from(roomsTable)
          .where(eq(roomsTable.id, reservation.roomId))
          .limit(1);
        if (room) {
          const newOcc = Math.max(0, room.currentOccupancy - 1);
          await tenantDb
            .update(roomsTable)
            .set({
              currentOccupancy: newOcc,
              status: newOcc === 0 ? "available" : "occupied",
            })
            .where(eq(roomsTable.id, reservation.roomId));
        }
      }

      const [updated] = await tenantDb
        .update(reservationsTable)
        .set({
          status: "COMPLETED",
          checkOutDate,
        })
        .where(eq(reservationsTable.id, id))
        .returning();

      return { updated, checkOutDate };
    });

    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const s = su(req);
    const guestName =
      `${result.updated.firstName ?? ""} ${result.updated.lastName ?? ""}`.trim() ||
      "Guest";
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل مغادرة الضيف: ${guestName}`,
      actionType: "CHECKOUT",
      module: "reservations",
      entityType: "reservation",
      entityId: result.updated.id,
      details: `Check-out: ${result.checkOutDate}`,
    });

    broadcastToProperty(propertyId, {
      module: "reservations",
      action: "checkout",
      entityId: result.updated.id,
    });
    if (result.updated.roomId)
      broadcastToProperty(propertyId, {
        module: "housing",
        action: "updated",
        entityId: result.updated.roomId,
      });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    res.json({ ...fmtReservation(result.updated), propertyId });
  },
);

router.patch(
  "/reservations/:id/cancel",
  requirePermission("reservations", "edit"),
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

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(reservationsTable)
        .set({ status: "CANCELLED" })
        .where(eq(reservationsTable.id, id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Reservation not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إلغاء حجز الضيف: ${(updated as any).guestName ?? updated.firstName}`,
      actionType: "CANCEL",
      module: "reservations",
      entityType: "reservation",
      entityId: updated.id,
      severity: "warning",
    });

    broadcastToProperty(propertyId, {
      module: "reservations",
      action: "updated",
      entityId: updated.id,
    });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    res.json({ ...fmtReservation(updated), propertyId });
  },
);

export default router;
