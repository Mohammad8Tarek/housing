import { Router } from "express";
import { db, withTenant, lookupValuesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getTenantId } from "../lib/request-utils.js";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get("/lookup-values", requireAuth, async (req, res): Promise<void> => {
  const propertyId = getTenantId(req);
  const category = req.query.category as string | undefined;
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const values = await withTenant(propertyId, async (tenantDb) => {
    const conditions: any[] = [];
    if (category) conditions.push(eq(lookupValuesTable.category, category));

    return await tenantDb
      .select()
      .from(lookupValuesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(lookupValuesTable.sortOrder, lookupValuesTable.value);
  });

  res.json(values.map((v) => ({ ...v, propertyId })));
});

router.post(
  "/lookup-values",
  requirePermission("settings", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    const { category, value, parentValue, sortOrder } = req.body;
    if (!propertyId || !category || !value) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    const [created] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(lookupValuesTable)
        .values({
          category,
          value,
          parentValue: parentValue ?? null,
          sortOrder: sortOrder ?? 0,
        } as any)
        .returning();
    });

    res.status(201).json({ ...created, propertyId });
  },
);

router.patch(
  "/lookup-values/:id",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const { value, parentValue, disabled, sortOrder } = req.body;
    const updateData: Record<string, any> = {};

    if (value !== undefined) updateData.value = String(value);
    if (sortOrder !== undefined)
      updateData.sortOrder = parseInt(String(sortOrder));
    if (parentValue !== undefined) {
      if (
        parentValue === null ||
        parentValue === "" ||
        parentValue === "null"
      ) {
        updateData.parentValue = null;
      } else {
        updateData.parentValue = String(parentValue);
      }
    }
    if (disabled !== undefined) updateData.disabled = Boolean(disabled);

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const updated = await withTenant(propertyId, async (tenantDb) => {
      const [result] = await tenantDb
        .update(lookupValuesTable)
        .set(updateData)
        .where(eq(lookupValuesTable.id, id))
        .returning();
      return result;
    });

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...updated, propertyId });
  },
);

router.delete(
  "/lookup-values/:id",
  requirePermission("settings", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(lookupValuesTable)
        .where(eq(lookupValuesTable.id, id));
    });

    res.sendStatus(204);
  },
);

export default router;
