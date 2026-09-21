import { Router } from "express";
import {
  db,
  withTenant,
  roomsTable,
  buildingsTable,
  floorsTable,
  propertiesTable,
  maintenanceTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import QRCode from "qrcode";
import { broadcastToProperty } from "../lib/websocket.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

// ─── 1. Get Room Info (Public) ──────────────────────────────────
router.get("/public/room-info", async (req, res): Promise<void> => {
  try {
    const propertyId = Number(req.query.propertyId || req.query.p);
    const roomId = Number(req.query.roomId || req.query.r);

    if (!propertyId || isNaN(propertyId) || !roomId || isNaN(roomId)) {
      res.status(400).json({ success: false, message: "propertyId and roomId are required" });
      return;
    }

    // 1. Fetch Property Info from public
    const [property] = await db
      .select({
        id: propertiesTable.id,
        name: propertiesTable.name,
        displayName: propertiesTable.displayName,
        logo: propertiesTable.logo,
        primaryColor: propertiesTable.primaryColor,
        status: propertiesTable.status,
      })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, propertyId))
      .limit(1);

    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    // 2. Fetch Room, Building, and Floor from tenant DB
    const roomData = await withTenant(propertyId, async (tenantDb) => {
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, roomId))
        .limit(1);

      if (!room) return null;

      const [building, floor] = await Promise.all([
        tenantDb
          .select({ id: buildingsTable.id, name: buildingsTable.name })
          .from(buildingsTable)
          .where(eq(buildingsTable.id, room.buildingId))
          .limit(1)
          .then((r) => r[0] ?? null),
        tenantDb
          .select({ id: floorsTable.id, floorNumber: floorsTable.floorNumber })
          .from(floorsTable)
          .where(eq(floorsTable.id, room.floorId))
          .limit(1)
          .then((r) => r[0] ?? null),
      ]);

      return {
        id: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        classification: (room as any).classification ?? null,
        capacity: room.capacity,
        currentOccupancy: room.currentOccupancy,
        status: room.status,
        cleanlinessStatus: (room as any).cleanlinessStatus ?? "clean",
        buildingName: building?.name || `Building #${room.buildingId}`,
        floorNumber: floor?.floorNumber ?? 0,
      };
    });

    if (!roomData) {
      res.status(404).json({ success: false, message: "Room not found in property" });
      return;
    }

    res.json({
      success: true,
      property: {
        id: property.id,
        name: property.name,
        displayName: property.displayName || property.name,
        logo: property.logo,
        primaryColor: property.primaryColor || "#0F2A44",
      },
      room: roomData,
    });
  } catch (err: any) {
    console.error("[Room Service Public] Error fetching room info:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to load room details" });
  }
});

// ─── 2. Submit Service Request (Maintenance or Housekeeping) ──
const RoomRequestSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
  category: z.enum(["maintenance", "housekeeping"]).default("maintenance"),
  problemType: z.string().min(1, "نوع الخدمة أو العطل مطلوب"),
  description: z.string().min(3, "يرجى كتابة تفاصيل الطلب (3 أحرف على الأقل)"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  reporterName: z.string().optional().default(""),
  reporterPhone: z.string().optional().default(""),
  photoUrl: z.string().optional().nullable(),
  preferredTime: z.string().optional().nullable(),
});

router.post("/public/room-request", async (req, res): Promise<void> => {
  try {
    const parsed = RoomRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || "Invalid input data",
      });
      return;
    }

    const {
      propertyId,
      roomId,
      category,
      problemType,
      description,
      priority,
      reporterName,
      reporterPhone,
      photoUrl,
      preferredTime,
    } = parsed.data;

    const result = await withTenant(propertyId, async (tenantDb) => {
      // Verify room exists
      const [room] = await tenantDb
        .select({ id: roomsTable.id, roomNumber: roomsTable.roomNumber })
        .from(roomsTable)
        .where(eq(roomsTable.id, roomId))
        .limit(1);

      if (!room) {
        return { error: "الغرفة غير مسجلة في هذا الفندق" };
      }

      const reporterLabel = reporterName
        ? `${reporterName}${reporterPhone ? ` (${reporterPhone})` : ""} - [مسح QR الباب]`
        : `نزيل الغرفة ${room.roomNumber} - [مسح QR الباب]`;

      const extraNotes = [
        "[طلب فوري عبر مسح QR كود الغرفة]",
        reporterPhone ? `هاتف المتصل: ${reporterPhone}` : "",
        preferredTime ? `الوقت المفضل: ${preferredTime}` : "",
      ].filter(Boolean).join(" | ");

      const [newTicket] = await tenantDb
        .insert(maintenanceTable)
        .values({
          roomId: room.id,
          category,
          problemType,
          description: description.trim(),
          priority,
          status: "open",
          reportedBy: reporterLabel,
          photoUrl: photoUrl || null,
          notes: extraNotes,
        } as any)
        .returning();

      return { ticket: newTicket, roomNumber: room.roomNumber };
    });

    if (result.error) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }

    const ticket = result.ticket as any;

    // Broadcast real-time WebSocket notifications to the admin dashboard
    broadcastToProperty(propertyId, {
      module: category === "housekeeping" ? "housekeeping" : "maintenance",
      action: "created",
      entityId: ticket.id,
      data: {
        source: "room_qr_scan",
        roomNumber: result.roomNumber,
        category,
        problemType,
        priority,
      },
    });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    // Activity Log
    await logActivity({
      req,
      propertyId,
      username: reporterName ? `${reporterName} (QR Scan)` : `غرفة ${result.roomNumber} (QR Scan)`,
      userRole: "resident",
      action: `طلب ${category === "housekeeping" ? "نظافة" : "صيانة"} عبر QR الغرفة ${result.roomNumber} (${problemType})`,
      actionType: "CREATE",
      module: category === "housekeeping" ? "housekeeping" : "maintenance",
      entityType: "maintenance",
      entityId: ticket.id,
      details: `الغرفة: ${result.roomNumber} | الطلب: ${description} | الأولوية: ${priority} | المتصل: ${reporterName || "غير محدد"} - ${reporterPhone || "بدون هاتف"}`,
    });

    res.status(201).json({
      success: true,
      message: category === "housekeeping"
        ? "تم إرسال طلب النظافة بنجاح وسيتوجه فريق الهاوس كيبنج للغرفة"
        : "تم تسجيل بلاغ الصيانة بنجاح وسيتم إرسال الفني المختص",
      ticketId: ticket.id,
      roomNumber: result.roomNumber,
      category,
      reportedAt: ticket.reportedAt,
    });
  } catch (err: any) {
    console.error("[Room Service Public] Error submitting request:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to submit service request",
    });
  }
});

// ─── 3. Generate QR Code Image / Data URL (Public or Admin) ────
router.get("/public/room-qr", async (req, res): Promise<void> => {
  try {
    const propertyId = Number(req.query.propertyId || req.query.p);
    const roomId = Number(req.query.roomId || req.query.r);
    const format = String(req.query.format || "dataurl"); // 'dataurl' or 'png' or 'svg'

    if (!propertyId || !roomId) {
      res.status(400).json({ error: "propertyId and roomId are required" });
      return;
    }

    // Determine target URL for the QR code
    let targetUrl = String(req.query.targetUrl || "");
    if (!targetUrl) {
      const host = req.get("host") || "localhost:5000";
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      targetUrl = `${protocol}://${host}/room-service?p=${propertyId}&r=${roomId}`;
    }

    if (format === "svg") {
      const svgString = await QRCode.toString(targetUrl, {
        type: "svg",
        margin: 1,
        color: {
          dark: "#0F2A44",
          light: "#FFFFFF",
        },
      });
      res.setHeader("Content-Type", "image/svg+xml");
      res.send(svgString);
      return;
    }

    if (format === "png") {
      const buffer = await QRCode.toBuffer(targetUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: "#0F2A44",
          light: "#FFFFFF",
        },
      });
      res.setHeader("Content-Type", "image/png");
      res.send(buffer);
      return;
    }

    // Default: Return JSON with data URL
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 500,
      margin: 1,
      color: {
        dark: "#0F2A44",
        light: "#FFFFFF",
      },
    });

    res.json({
      success: true,
      targetUrl,
      qrDataUrl,
    });
  } catch (err: any) {
    console.error("[Room QR Generator] Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate QR code" });
  }
});

export default router;
