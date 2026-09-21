import { Router } from "express";
import { db, withTenant, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";
import { sendTestEmail } from "../lib/email-service.js";

const router: Router = Router();

router.get("/settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const settings = await withTenant(propertyId, async (tenantDb) => {
      const [s] = await tenantDb.select().from(settingsTable).limit(1);
      return s;
    });

    if (!settings) {
      res.status(404).json({ error: "Settings not found" });
      return;
    }
    const hasSmtpPass = Boolean((settings as any).smtpPass);
    res.json({
      ...settings,
      propertyId,
      portalContactEmail: settings.portalContactEmail ?? null,
      portalContactPhone: settings.portalContactPhone ?? null,
      portalContactExt: settings.portalContactExt ?? null,
      smtpHost: (settings as any).smtpHost ?? null,
      smtpPort: (settings as any).smtpPort ?? 587,
      smtpSecure: (settings as any).smtpSecure ?? false,
      smtpUser: (settings as any).smtpUser ?? null,
      smtpPass: hasSmtpPass ? "••••••••" : "",
      hasSmtpPass,
      smtpFrom: (settings as any).smtpFrom ?? null,
      updatedAt:
        settings.updatedAt instanceof Date &&
        typeof settings.updatedAt.toISOString === "function"
          ? settings.updatedAt.toISOString()
          : settings.updatedAt,
    });
  } catch (err: any) {
    console.error("[settings/get] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch(
  "/settings",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const allowedFields = [
        "systemName",
        "systemLogo",
        "defaultLanguage",
        "primaryColor",
        "sidebarColor",
        "buttonColor",
        "departureAlertsEnabled",
        "departureAlertThreshold",
        "reportFooter",
        "portalContactEmail",
        "portalContactPhone",
        "portalContactExt",
        // ─── Password Policy ─────────────────────────────────────────
        "passwordMinLength",
        "passwordRequireUppercase",
        "passwordRequireLowercase",
        "passwordRequireNumber",
        "passwordRequireSymbol",
        "passwordExpiryDays",
        "passwordHistoryCount",
        // ─── Account Lockout ─────────────────────────────────────────
        "lockoutThreshold",
        "lockoutDurationMinutes",
        // ─── Email (SMTP) Configuration ──────────────────────────────
        "smtpHost",
        "smtpPort",
        "smtpSecure",
        "smtpUser",
        "smtpPass",
        "smtpFrom",
        // ─── Housing Policy ──────────────────────────────────────────
        "policyLevel0Capacity",
        "policyLevel1Capacity",
        "policyLevel2Capacity",
        "policyLevel3Capacity",
        "policyLevel4Capacity",
        "policyLevel0AllowEntire",
        "policyLevel1AllowEntire",
        "policyLevel2AllowEntire",
        "policyDepartmentClustering",
        "policyStrictDepartmentSegregation",
        // ─── Family Visit Policy ─────────────────────────────────────
        "visitMaxNights",
        "visitMaxVisitsPerYear",
        "visitMinServiceMonths",
        "visitCooldownDays",
        "visitRequireNationalId",
        // ─── Housing Rules & Regulations ─────────────────────────────
        "curfewEnabled",
        "curfewTime",
        "housingRulesText",
        "familyVisitPolicyText",
        "housingPolicyText",
        // ─── Key Contacts ────────────────────────────────────────────
        "hrContact1Name",
        "hrContact1Title",
        "hrContact1Phone",
        "hrContact1Email",
        "hrContact2Name",
        "hrContact2Title",
        "hrContact2Phone",
        "hrContact2Email",
        "housingManager1Name",
        "housingManager1Title",
        "housingManager1Phone",
        "housingManager1Email",
        "housingManager2Name",
        "housingManager2Title",
        "housingManager2Phone",
        "housingManager2Email",
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      }

      // Safeguard SMTP password from being overwritten with placeholder or empty string
      if (updateData.smtpPass === "••••••••" || updateData.smtpPass === "") {
        delete updateData.smtpPass;
      }
      if (updateData.smtpPort !== undefined) {
        updateData.smtpPort = Number(updateData.smtpPort) || 587;
      }
      if (updateData.smtpSecure !== undefined) {
        updateData.smtpSecure = Boolean(updateData.smtpSecure);
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No valid fields provided" });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        const [s] = await tenantDb.select().from(settingsTable).limit(1);
        if (!s) return [];
        return await tenantDb
          .update(settingsTable)
          .set(updateData)
          .where(eq(settingsTable.id, s.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Settings not found" });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: "تحديث إعدادات النظام",
        actionType: "UPDATE",
        module: "settings",
        entityType: "settings",
        entityId: updated.id,
      });

      const hasSmtpPass = Boolean((updated as any).smtpPass);
      res.json({
        ...updated,
        propertyId,
        smtpPass: hasSmtpPass ? "••••••••" : "",
        hasSmtpPass,
        updatedAt:
          updated.updatedAt instanceof Date &&
          typeof updated.updatedAt.toISOString === "function"
            ? updated.updatedAt.toISOString()
            : updated.updatedAt,
      });
    } catch (err: any) {
      console.error("[settings/patch] Error:", err.message);
      res.status(500).json({ error: "Failed to update settings" });
    }
  },
);

router.post(
  "/settings/email/test",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const { toEmail, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom } = req.body || {};

      if (!toEmail || !toEmail.includes("@")) {
        res.status(400).json({ error: "البريد الإلكتروني للمستلم مطلوب وغير صالح / Valid recipient email is required" });
        return;
      }

      let savedSettings: any = null;
      if (propertyId) {
        savedSettings = await withTenant(propertyId, async (tenantDb) => {
          const [s] = await tenantDb.select().from(settingsTable).limit(1);
          return s;
        });
      }

      let resolvedPass = smtpPass;
      if (!resolvedPass || resolvedPass === "••••••••") {
        resolvedPass = savedSettings?.smtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
      }

      const config = {
        smtpHost: smtpHost || savedSettings?.smtpHost || process.env.SMTP_HOST,
        smtpPort: smtpPort ? Number(smtpPort) : (savedSettings?.smtpPort ? Number(savedSettings.smtpPort) : Number(process.env.SMTP_PORT || 587)),
        smtpSecure: smtpSecure !== undefined ? Boolean(smtpSecure) : (savedSettings?.smtpSecure !== undefined ? Boolean(savedSettings.smtpSecure) : undefined),
        smtpUser: smtpUser || savedSettings?.smtpUser || process.env.SMTP_USER,
        smtpPass: resolvedPass,
        smtpFrom: smtpFrom || savedSettings?.smtpFrom || process.env.SMTP_FROM,
      };

      if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
        res.status(400).json({
          error: "بيانات سيرفر البريد (Host / User / Password) غير مكتملة / Incomplete SMTP credentials",
        });
        return;
      }

      const result = await sendTestEmail({ toEmail, config });
      if (result.success) {
        res.json({
          success: true,
          message: "تم إرسال البريد الإلكتروني التجريبي بنجاح / Test email sent successfully",
          messageId: result.messageId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "فشل إرسال البريد التجريبي / Failed to send test email",
        });
      }
    } catch (err: any) {
      console.error("[settings/email/test] Error:", err?.message || err);
      res.status(500).json({ error: err?.message || "Internal server error" });
    }
  },
);

// ─── Portal Contacts endpoint ──────────────────────────────────────────
router.get(
  "/settings/portal-contacts",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const settings = await withTenant(propertyId, async (tenantDb) => {
        const [s] = await tenantDb.select().from(settingsTable).limit(1);
        return s;
      });

      res.json({
        success: true,
        email: settings?.portalContactEmail ?? "hr@sunrise-housing.com",
        phone: settings?.portalContactPhone ?? "",
        extension: settings?.portalContactExt ?? "#4055",
      });
    } catch (err: any) {
      console.error("[settings/portal-contacts] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch portal contacts" });
    }
  },
);

export default router;
