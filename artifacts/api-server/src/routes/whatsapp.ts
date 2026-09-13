import { Router } from "express";
import { pool } from "@workspace/db";
import { getTenantId } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";
import {
  getWhatsAppSession,
  connectPropertyWhatsApp,
  disconnectPropertyWhatsApp,
  sendWhatsAppMessageSafe,
  compileWhatsAppTemplate,
} from "../lib/whatsapp-engine.js";

const router = Router();

// GET /api/whatsapp/status - جلب حالة الاتصال الحالية والكود المربع
// @ts-ignore
router.get("/status", requirePermission("settings", "view"), async (req, res) => {
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

    const effectiveStatus = session.status !== "disconnected" ? session.status : (dbRow?.status || "disconnected");
    const effectivePhone = session.phoneNumber || dbRow?.phone_number || null;
    const effectiveQr = session.qrCode || dbRow?.qr_code || null;

    res.json({
      success: true,
      status: effectiveStatus,
      phoneNumber: effectivePhone,
      qrCode: effectiveQr,
      isAutoSendEnabled: dbRow ? dbRow.is_auto_send_enabled : true,
      updatedAt: dbRow?.updated_at || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/connect - بدء عملية الربط وتوليد رمز QR
// @ts-ignore
router.post("/connect", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const session = await connectPropertyWhatsApp(propertyId);

    res.json({
      success: true,
      status: session.status,
      phoneNumber: session.phoneNumber || null,
      qrCode: session.qrCode || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/disconnect - قطع الاتصال وتسجيل الخروج
// @ts-ignore
router.post("/disconnect", requirePermission("settings", "edit"), async (req, res) => {
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
router.get("/config", requirePermission("settings", "view"), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const dbRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );

    if (dbRes.rows.length === 0) {
      // Default config
      const defaultAr =
        "مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n📱 للدخول إلى بوابة الموظفين وطلب الخدمات:\n{portal_url}\n\nنتمنى لك إقامة هانئة ومريحة! ✨";
      const defaultEn =
        "Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n📱 Access Resident Portal:\n{portal_url}\n\nWe wish you a pleasant and comfortable stay! ✨";

      return res.json({
        success: true,
        config: {
          propertyId,
          isAutoSendEnabled: true,
          welcomeTemplateAr: defaultAr,
          welcomeTemplateEn: defaultEn,
          supervisorContact: "",
        },
      });
    }

    const row = dbRes.rows[0];
    res.json({
      success: true,
      config: {
        propertyId: row.property_id,
        status: row.status,
        phoneNumber: row.phone_number,
        isAutoSendEnabled: row.is_auto_send_enabled,
        welcomeTemplateAr: row.welcome_template_ar,
        welcomeTemplateEn: row.welcome_template_en,
        supervisorContact: row.supervisor_contact || "",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/whatsapp/config - حفظ وتحديث قوالب الواتساب
// @ts-ignore
router.put("/config", requirePermission("settings", "edit"), async (req, res) => {
  try {
    const propertyId = getTenantId(req) || 1;
    const {
      isAutoSendEnabled,
      welcomeTemplateAr,
      welcomeTemplateEn,
      supervisorContact,
    } = req.body;

    const query = `
      INSERT INTO public.property_whatsapp_configs
        (property_id, is_auto_send_enabled, welcome_template_ar, welcome_template_en, supervisor_contact, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (property_id) DO UPDATE
      SET is_auto_send_enabled = EXCLUDED.is_auto_send_enabled,
          welcome_template_ar = EXCLUDED.welcome_template_ar,
          welcome_template_en = EXCLUDED.welcome_template_en,
          supervisor_contact = EXCLUDED.supervisor_contact,
          updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      propertyId,
      isAutoSendEnabled !== undefined ? Boolean(isAutoSendEnabled) : true,
      welcomeTemplateAr || "",
      welcomeTemplateEn || "",
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
router.post("/test", requirePermission("settings", "edit"), async (req, res) => {
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
        property_name: isEn ? "Sunrise Resort Housing" : "منتجع سكن صن رايز",
        building_name: isEn ? "Building 3" : "المبنى رقم 3",
        floor_name: isEn ? "Second Floor" : "الدور الثاني",
        room_number: "204",
        bed_label: "Bed A",
        checkin_date: new Date().toISOString().split("T")[0],
        portal_url: process.env.PORTAL_URL || "https://portal.sunrise-housing.com",
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
router.get("/logs", requirePermission("settings", "view"), async (req, res) => {
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

export default router;
