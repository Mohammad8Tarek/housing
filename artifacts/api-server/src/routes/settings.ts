import { Router } from "express";
import { db, withTenant, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get("/settings", requirePermission("settings", "view"), async (req, res): Promise<void> => {
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
    res.json({
      ...settings,
      propertyId,
      portalContactEmail: settings.portalContactEmail ?? null,
      portalContactPhone: settings.portalContactPhone ?? null,
      portalContactExt: settings.portalContactExt ?? null,
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
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
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
      res.json({
        ...updated,
        propertyId,
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

// ─── Portal Contacts endpoint ──────────────────────────────────────────
router.get(
  "/settings/portal-contacts",
  requirePermission("settings", "view"),
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
