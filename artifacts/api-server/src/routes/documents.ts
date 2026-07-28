import { Router } from "express";
import { db, withTenant, portalDocumentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { stripHtml } from "../lib/sanitize.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();
const MAX_DOCUMENT_DATA_LENGTH = Number(
  process.env["PORTAL_DOCUMENT_MAX_DATA_LENGTH"] ?? 8 * 1024 * 1024,
);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function cleanText(value: unknown, max = 180): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeFileName(value: unknown): string {
  return cleanText(value, 180).replace(/[^\w.\- ()]/g, "") || "document";
}

function validateDocumentData(fileType: unknown, fileData: unknown): string {
  const type = cleanText(fileType, 160);
  const data = String(fileData ?? "");
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(type)) {
    throw new Error("Unsupported document type");
  }
  if (data.length > MAX_DOCUMENT_DATA_LENGTH) {
    throw new Error("Document is too large");
  }
  const prefix = `data:${type};base64,`;
  if (
    !data.startsWith(prefix) ||
    !/^[A-Za-z0-9+/=]+$/.test(data.slice(prefix.length))
  ) {
    throw new Error("Invalid document data");
  }
  return data;
}

// @ts-ignore
router.get(
  "/",
  requirePermission("documents", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const rows = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(portalDocumentsTable)
          .orderBy(desc(portalDocumentsTable.createdAt));
      });

      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.post(
  "/",
  requirePermission("documents", "create"),
  async (req, res, next) => {
    try {
      const propertyId = Number(req.body?.propertyId);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const { titleAr, titleEn, fileName, fileType, fileData, category } =
        req.body;

      if (!titleAr || !fileName || !fileType || !fileData) {
        return res.status(400).json({
          success: false,
          message: "titleAr, fileName, fileType, fileData are required",
        });
      }

      let normalizedFileData: string;
      try {
        normalizedFileData = validateDocumentData(fileType, fileData);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: error.message || "Invalid document",
        });
      }

      const [record] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .insert(portalDocumentsTable)
          .values({
            titleAr: stripHtml(cleanText(titleAr, 180)),
            titleEn: titleEn ? stripHtml(cleanText(titleEn, 180)) : null,
            fileName: normalizeFileName(fileName),
            fileType: cleanText(fileType, 160),
            fileData: normalizedFileData,
            category: cleanText(category ?? "policy", 80),
          } as any)
          .returning();
      });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `رفع مستند: ${titleAr}`,
        actionType: "CREATE",
        module: "documents",
        entityType: "portal_document",
        entityId: record.id,
      });

      broadcastToProperty(propertyId, {
        type: "data_updated",
        module: "notifications",
        action: "created",
      });

      return res.status(201).json(record);
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.delete(
  "/:id",
  requirePermission("documents", "delete"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const id = Number(req.params.id);
      if (!id)
        return res.status(400).json({ success: false, message: "id required" });

      const [record] = await withTenant(propertyId, async (tenantDb) => {
        const [r] = await tenantDb
          .select()
          .from(portalDocumentsTable)
          .where(eq(portalDocumentsTable.id, id));
        if (r)
          await tenantDb
            .delete(portalDocumentsTable)
            .where(eq(portalDocumentsTable.id, id));
        return [r];
      });

      if (!record)
        return res
          .status(404)
          .json({ success: false, message: "المستند غير موجود" });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف مستند: ${record.titleAr}`,
        actionType: "DELETE",
        module: "documents",
        entityType: "portal_document",
        entityId: record.id,
      });

      return res.sendStatus(204);
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
