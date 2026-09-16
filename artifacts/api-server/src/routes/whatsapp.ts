import { Router } from "express";
import { pool } from "@workspace/db";
import { getTenantId } from "../lib/request-utils.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";
import {
  getWhatsAppSession,
  connectPropertyWhatsApp,
  disconnectPropertyWhatsApp,
  sendWhatsAppMessageSafe,
  compileWhatsAppTemplate,
  DEFAULT_WELCOME_AR,
  DEFAULT_WELCOME_EN,
  DEFAULT_RESERVATION_AR,
  DEFAULT_RESERVATION_EN,
  sendWhatsAppBroadcast,
  BroadcastRecipient,
  getPendingQueueCount,
  processOutboxQueue,
} from "../lib/whatsapp-engine.js";

const router = Router();

// GET /api/whatsapp/status - جلب حالة الاتصال الحالية والكود المربع
// @ts-ignore
router.get("/status", requireAnyPermission(["whatsapp", "view"], ["settings", "view"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const session = await getWhatsAppSession(propertyId);

    // Also check DB for persisted config
    const dbRes = await pool.query(
      `SELECT status, phone_number, qr_code, is_auto_send_enabled, updated_at
       FROM public.property_whatsapp_configs
       WHERE property_id = $1`,
      [propertyId]
    );
    const dbRow = dbRes.rows[0];

    // Only consider DB QR code if it was updated in the last 75 seconds (WhatsApp QR expiry)
    let effectiveQr: string | null = session.qrCode || null;
    if (!effectiveQr && dbRow?.status === "pairing" && dbRow?.qr_code && dbRow?.updated_at) {
      const ageMs = Date.now() - new Date(dbRow.updated_at).getTime();
      if (ageMs < 75000) {
        effectiveQr = dbRow.qr_code;
      }
    }

    let effectiveStatus = session.status;
    if (session.status === "disconnected") {
      if (dbRow?.status === "connected") {
        effectiveStatus = "connected";
      } else if (effectiveQr) {
        effectiveStatus = "pairing";
      } else {
        effectiveStatus = "disconnected";
      }
    }

    const effectivePhone = session.phoneNumber || dbRow?.phone_number || null;
    const pendingQueueCount = await getPendingQueueCount(propertyId);

    res.json({
      success: true,
      status: effectiveStatus,
      phoneNumber: effectivePhone,
      qrCode: effectiveQr,
      isAutoSendEnabled: dbRow ? dbRow.is_auto_send_enabled : true,
      pendingQueueCount,
      updatedAt: dbRow?.updated_at || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/queue/process - معالجة فورية لطابور الرسائل المعلقة
// @ts-ignore
router.post("/queue/process", requireAnyPermission(["whatsapp", "edit"], ["settings", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const result = await processOutboxQueue(propertyId);
    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/connect - بدء عملية الربط وتوليد رمز QR
// @ts-ignore
router.post("/connect", requireAnyPermission(["whatsapp", "edit"], ["settings", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const session = await connectPropertyWhatsApp(propertyId, true);

    // Wait up to 4.5 seconds for QR code generation so client receives QR immediately
    let qrCode = session.qrCode;
    if (!qrCode && session.status !== "connected") {
      for (let i = 0; i < 9; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const s = await getWhatsAppSession(propertyId);
        if (s.qrCode || s.status === "connected") {
          qrCode = s.qrCode;
          break;
        }
      }
    }

    res.json({
      success: true,
      status: session.status,
      phoneNumber: session.phoneNumber || null,
      qrCode: qrCode || session.qrCode || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/disconnect - قطع الاتصال وتسجيل الخروج
// @ts-ignore
router.post("/disconnect", requireAnyPermission(["whatsapp", "edit"], ["settings", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    await disconnectPropertyWhatsApp(propertyId);

    res.json({
      success: true,
      status: "disconnected",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/whatsapp/config - استرجاع قوالب وإعدادات الواتساب
// @ts-ignore
router.get("/config", requireAnyPermission(["whatsapp", "view"], ["settings", "view"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const dbRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );

    if (dbRes.rows.length === 0) {
      return res.json({
        success: true,
        config: {
          propertyId,
          isAutoSendEnabled: true,
          welcomeTemplateAr: DEFAULT_WELCOME_AR,
          welcomeTemplateEn: DEFAULT_WELCOME_EN,
          isReservationSendEnabled: true,
          reservationTemplateAr: DEFAULT_RESERVATION_AR,
          reservationTemplateEn: DEFAULT_RESERVATION_EN,
          supervisorContact: "",
        },
      });
    }

    const row = dbRes.rows[0];
    const rawWelcomeAr = row.welcome_template_ar || "";
    const cleanWelcomeAr = (rawWelcomeAr && !rawWelcomeAr.includes("???")) ? rawWelcomeAr : DEFAULT_WELCOME_AR;
    const rawResAr = row.reservation_template_ar || "";
    const cleanResAr = (rawResAr && !rawResAr.includes("???")) ? rawResAr : DEFAULT_RESERVATION_AR;

    res.json({
      success: true,
      config: {
        propertyId: row.property_id,
        status: row.status,
        phoneNumber: row.phone_number,
        isAutoSendEnabled: row.is_auto_send_enabled,
        welcomeTemplateAr: cleanWelcomeAr,
        welcomeTemplateEn: row.welcome_template_en || DEFAULT_WELCOME_EN,
        isReservationSendEnabled: row.is_reservation_send_enabled ?? true,
        reservationTemplateAr: cleanResAr,
        reservationTemplateEn: row.reservation_template_en || DEFAULT_RESERVATION_EN,
        supervisorContact: row.supervisor_contact || "",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/whatsapp/config - حفظ وتحديث قوالب الواتساب
// @ts-ignore
router.put("/config", requireAnyPermission(["whatsapp", "edit"], ["settings", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const {
      isAutoSendEnabled,
      welcomeTemplateAr,
      welcomeTemplateEn,
      isReservationSendEnabled,
      reservationTemplateAr,
      reservationTemplateEn,
      supervisorContact,
    } = req.body;

    const query = `
      INSERT INTO public.property_whatsapp_configs
        (property_id, is_auto_send_enabled, welcome_template_ar, welcome_template_en,
         is_reservation_send_enabled, reservation_template_ar, reservation_template_en,
         supervisor_contact, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (property_id) DO UPDATE
      SET is_auto_send_enabled = EXCLUDED.is_auto_send_enabled,
          welcome_template_ar = EXCLUDED.welcome_template_ar,
          welcome_template_en = EXCLUDED.welcome_template_en,
          is_reservation_send_enabled = EXCLUDED.is_reservation_send_enabled,
          reservation_template_ar = EXCLUDED.reservation_template_ar,
          reservation_template_en = EXCLUDED.reservation_template_en,
          supervisor_contact = EXCLUDED.supervisor_contact,
          updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      propertyId,
      isAutoSendEnabled !== undefined ? Boolean(isAutoSendEnabled) : true,
      welcomeTemplateAr || DEFAULT_WELCOME_AR,
      welcomeTemplateEn || DEFAULT_WELCOME_EN,
      isReservationSendEnabled !== undefined ? Boolean(isReservationSendEnabled) : true,
      reservationTemplateAr || DEFAULT_RESERVATION_AR,
      reservationTemplateEn || DEFAULT_RESERVATION_EN,
      supervisorContact || "",
    ]);

    res.json({
      success: true,
      config: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/test - إرسال رسالة تجريبية
// @ts-ignore
router.post("/test", requireAnyPermission(["whatsapp", "create"], ["whatsapp", "edit"], ["settings", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const { phone, message, language } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: "رقم الهاتف مطلوب" });
    }

    let textToSend = message;
    if (!textToSend || !textToSend.trim()) {
      // Use template with mock data
      const configRes = await pool.query(
        `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
        [propertyId]
      );
      const row = configRes.rows[0];
      const isEn = language === "en";
      const template = isEn
        ? row?.welcome_template_en || "Test message from Sunrise Housing"
        : row?.welcome_template_ar || "رسالة تجريبية من نظام إدارة سكن صن رايز";

      const mockVars = {
        employee_name: isEn ? "Mohamed Tarek" : "محمد طارق",
        profile_id: "10575",
        employee_id: "10575",
        property_name: isEn ? "Sunrise Resort Housing" : "منتجع سكن صن رايز",
        building_name: isEn ? "Building 3" : "المبنى رقم 3",
        floor_name: isEn ? "Second Floor" : "الدور الثاني",
        room_number: "204",
        bed_label: "Bed A",
        checkin_date: new Date().toISOString().split("T")[0],
        portal_url: process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/",
        supervisor_contact: row?.supervisor_contact || "+201000000000",
      };

      textToSend = compileWhatsAppTemplate(template, mockVars);
    }

    const sendRes = await sendWhatsAppMessageSafe(
      propertyId,
      phone,
      textToSend,
      "TEST",
      "Test Recipient"
    );

    if (!sendRes.success) {
      return res.status(400).json({
        success: false,
        error: sendRes.reason || "تعذر إرسال الرسالة",
      });
    }

    res.json({
      success: true,
      message: "تم إرسال الرسالة التجريبية بنجاح",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/whatsapp/logs - سجل الرسائل المرسلة
// @ts-ignore
router.get("/logs", requireAnyPermission(["whatsapp", "view"], ["whatsapp", "export"], ["settings", "view"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(5, parseInt(String(req.query.limit || "10"), 10)));
    const offset = (page - 1) * limit;

    const totalRes = await pool.query(
      `SELECT COUNT(*) as count FROM public.whatsapp_delivery_logs WHERE property_id = $1`,
      [propertyId]
    );
    const total = parseInt(totalRes.rows[0]?.count || "0", 10);

    const logsRes = await pool.query(
      `SELECT * FROM public.whatsapp_delivery_logs
       WHERE property_id = $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [propertyId, limit, offset]
    );

    res.json({
      success: true,
      logs: logsRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/broadcast/preview - معاينة المستلمين لرسالة جماعية
// @ts-ignore
router.post("/broadcast/preview", requireAnyPermission(["whatsapp", "view"], ["accommodation", "view"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const { targetType, buildingId, floorId, roomIds, profileIds } = req.body;

    // Resolve tenant schema name
    const propRes = await pool.query(
      `SELECT schema_name, display_name, name FROM public.properties WHERE id = $1`,
      [propertyId]
    );
    const schemaName = (propRes.rows[0]?.schema_name || "public").trim();

    const whereConditions: string[] = [`a.status = 'ACTIVE'`];
    const params: any[] = [];

    if (targetType === "BUILDING" && buildingId) {
      params.push(parseInt(String(buildingId), 10));
      whereConditions.push(`r.building_id = $${params.length}`);
    } else if (targetType === "FLOOR" && floorId) {
      params.push(parseInt(String(floorId), 10));
      whereConditions.push(`r.floor_id = $${params.length}`);
    } else if (targetType === "ROOMS" && Array.isArray(roomIds) && roomIds.length > 0) {
      const validRoomIds = roomIds.map(Number).filter((n) => !isNaN(n));
      if (validRoomIds.length > 0) {
        params.push(validRoomIds);
        whereConditions.push(`a.room_id = ANY($${params.length})`);
      }
    } else if ((targetType === "INDIVIDUALS" || targetType === "SELECTED") && Array.isArray(profileIds) && profileIds.length > 0) {
      const validProfileIds = profileIds.map(Number).filter((n) => !isNaN(n));
      if (validProfileIds.length > 0) {
        params.push(validProfileIds);
        whereConditions.push(`a.profile_id = ANY($${params.length})`);
      }
    }

    const query = `
      SELECT 
        p.id as profile_id,
        p.first_name,
        p.last_name,
        p.phone,
        p.nationality,
        p.department,
        r.id as room_id,
        r.room_number,
        b.name as building_name,
        f.floor_number as floor_name
      FROM ${schemaName}.assignments a
      JOIN ${schemaName}.profiles p ON a.profile_id = p.id
      JOIN ${schemaName}.rooms r ON a.room_id = r.id
      LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
      LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY b.name ASC, r.room_number ASC, p.first_name ASC
    `;

    const result = await pool.query(query, params);

    // De-duplicate if person has multiple active assignments
    const seenProfiles = new Set<number>();
    const recipients: any[] = [];
    let readyCount = 0;
    let missingPhoneCount = 0;

    for (const row of result.rows) {
      if (seenProfiles.has(row.profile_id)) continue;
      seenProfiles.add(row.profile_id);

      const cleanPhone = (row.phone || "").trim();
      const hasValidPhone = Boolean(cleanPhone && cleanPhone.replace(/[^0-9]/g, "").length >= 8);
      if (hasValidPhone) {
        readyCount++;
      } else {
        missingPhoneCount++;
      }

      recipients.push({
        profileId: row.profile_id,
        name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || `Employee #${row.profile_id}`,
        phone: cleanPhone,
        hasPhone: hasValidPhone,
        nationality: row.nationality || "",
        department: row.department || "",
        roomId: row.room_id,
        roomNumber: row.room_number || "",
        buildingName: row.building_name || "",
        floorName: row.floor_name ? `الدور ${row.floor_name}` : "",
      });
    }

    res.json({
      success: true,
      totalMatched: recipients.length,
      readyCount,
      missingPhoneCount,
      recipients,
    });
  } catch (err: any) {
    console.error("[POST /api/whatsapp/broadcast/preview] error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/broadcast/send - إطلاق إرسال الرسالة الجماعية
// @ts-ignore
router.post("/broadcast/send", requireAnyPermission(["whatsapp", "create"], ["accommodation", "edit"]), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const { recipients, messageText } = req.body;

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ success: false, error: "نص الرسالة مطلوب" });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: "قائمة المستلمين فارغة" });
    }

    // Filter only those with phone
    const validRecipients: BroadcastRecipient[] = recipients
      .filter((r: any) => r && r.phone && String(r.phone).trim().replace(/[^0-9]/g, "").length >= 8)
      .map((r: any) => ({
        profileId: Number(r.profileId),
        name: String(r.name || ""),
        phone: String(r.phone).trim(),
        roomNumber: r.roomNumber ? String(r.roomNumber) : undefined,
        buildingName: r.buildingName ? String(r.buildingName) : undefined,
        floorName: r.floorName ? String(r.floorName) : undefined,
      }));

    if (validRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: "لا يوجد مستلمون بأرقام هواتف صالحة لإرسال الرسالة إليهم",
      });
    }

    const session = await getWhatsAppSession(propertyId);
    if (session.status !== "connected" && !session.sock) {
      return res.status(400).json({
        success: false,
        error: "خدمة الواتساب غير متصلة حالياً. يرجى التأكد من ربط الحساب أولاً من الإعدادات.",
      });
    }

    const result = await sendWhatsAppBroadcast({
      propertyId,
      recipients: validRecipients,
      messageText: messageText.trim(),
    });

    res.json({
      success: true,
      message: `تم جدولة إرسال ${result.queued} رسالة في الخلفية بنظام الأمان ضد الحظر.`,
      stats: {
        totalRequested: recipients.length,
        queued: result.queued,
        skippedNoPhone: recipients.length - validRecipients.length,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/whatsapp/broadcast/send] error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
