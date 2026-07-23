import { Router } from "express";
import { db, withTenant, portalContactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { sanitizeFields } from "../lib/sanitize.js";

const router = Router();

const CreateContactSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  roleAr: z.string().optional().nullable(),
  roleEn: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  extension: z.string().optional().nullable(),
});

const UpdateContactSchema = CreateContactSchema.partial();

function getTenantId(req: any): number {
  return (
    Number(req.query?.propertyId) ||
    Number(req.body?.propertyId) ||
    Number((req.session as any)?.propertyId) ||
    0
  );
}

// GET all contacts for a property
router.get("/portal-contacts", requireAuth, async (req, res): Promise<void> => {
  const propertyId = getTenantId(req);
  if (!propertyId) {
    res.status(400).json({ success: false, message: "propertyId required" });
    return;
  }

  const contacts = await withTenant(propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(portalContactsTable)
      .orderBy(portalContactsTable.createdAt);
  });

  res.json({ success: true, contacts });
});

// POST create a new contact
router.post(
  "/portal-contacts",
  requireAuth,
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId required" });
      return;
    }

    const parsed = CreateContactSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          success: false,
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        });
      return;
    }

    const sanitized = sanitizeFields(parsed.data, [
      "nameAr",
      "nameEn",
      "roleAr",
      "roleEn",
      "phone",
      "email",
      "extension",
    ]);

    const [created] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(portalContactsTable)
        .values({
          propertyId,
          nameAr: sanitized.nameAr,
          nameEn: sanitized.nameEn,
          roleAr: sanitized.roleAr || null,
          roleEn: sanitized.roleEn || null,
          phone: sanitized.phone || null,
          email: sanitized.email || null,
          extension: sanitized.extension || null,
        })
        .returning();
    });

    res.json({ success: true, contact: created });
  },
);

// PUT update a contact
router.put(
  "/portal-contacts/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId required" });
      return;
    }

    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "id required" });
      return;
    }

    const parsed = UpdateContactSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          success: false,
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        });
      return;
    }

    const sanitized = sanitizeFields(parsed.data, [
      "nameAr",
      "nameEn",
      "roleAr",
      "roleEn",
      "phone",
      "email",
      "extension",
    ]);

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(portalContactsTable)
        .set({
          nameAr: sanitized.nameAr,
          nameEn: sanitized.nameEn,
          roleAr: sanitized.roleAr || null,
          roleEn: sanitized.roleEn || null,
          phone: sanitized.phone || null,
          email: sanitized.email || null,
          extension: sanitized.extension || null,
        })
        .where(eq(portalContactsTable.id, id))
        .returning();
    });

    res.json({ success: true, contact: updated });
  },
);

// DELETE a contact
router.delete(
  "/portal-contacts/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId required" });
      return;
    }

    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "id required" });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(portalContactsTable)
        .where(eq(portalContactsTable.id, id));
    });

    res.json({ success: true });
  },
);

export default router;
