import { Router } from "express";
import { db, withTenant, lookupValuesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getTenantId } from "../lib/request-utils.js";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();

// ─── GET /lookup-values ───────────────────────────────────────────────────────
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

    let results = await tenantDb
      .select()
      .from(lookupValuesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(lookupValuesTable.sortOrder, lookupValuesTable.value);

    // Auto-seed room classifications if requested category is room_classification and empty
    if (category === "room_classification" && results.length === 0) {
      const defaults = [
        { category: "room_classification", value: "Deluxe room", parentValue: "Single", extraValue: "Level 1 / VIP / Executive", sortOrder: 1 },
        { category: "room_classification", value: "Superior room", parentValue: "Single", extraValue: "Level 2 / Supervisory / Senior", sortOrder: 2 },
        { category: "room_classification", value: "Family suite", parentValue: "Suite", extraValue: "Family / Multi-Bed / Largest Capacity", sortOrder: 3 },
        { category: "room_classification", value: "Standard room", parentValue: "Double", extraValue: "Staff / Operations", sortOrder: 4 },
      ];
      try {
        await tenantDb.insert(lookupValuesTable).values(defaults as any);
        results = await tenantDb
          .select()
          .from(lookupValuesTable)
          .where(and(...conditions))
          .orderBy(lookupValuesTable.sortOrder, lookupValuesTable.value);
      } catch (e) {
        console.warn("Failed to auto-seed room classifications:", e);
      }
    }

    return results;
  });

  res.json(values.map((v) => ({ ...v, propertyId })));
});

// ─── POST /lookup-values ──────────────────────────────────────────────────────
router.post(
  "/lookup-values",
  requirePermission("settings", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    const { category, value, parentValue, extraValue, sortOrder } = req.body;
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
          extraValue: extraValue ?? null,
          sortOrder: sortOrder ?? 0,
        } as any)
        .returning();
    });

    broadcastToProperty(propertyId, { module: "settings", action: "updated" });
    res.status(201).json({ ...created, propertyId });
  },
);

// ─── POST /lookup-values/bulk ────────────────────────────────────────────────
router.post(
  "/lookup-values/bulk",
  requirePermission("settings", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    const { items } = req.body;
    if (!propertyId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "propertyId and non-empty items array required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const categories = Array.from(new Set(items.map((i: any) => String(i.category || "").trim()).filter(Boolean)));
        const existing = await tenantDb
          .select()
          .from(lookupValuesTable)
          .where(sql`${lookupValuesTable.category} IN ${categories}`);

        // Map key: `${category}:::${value.toLowerCase()}:::${(parentValue||'').toLowerCase()}`
        const existingMap = new Map<string, any>();
        for (const row of existing) {
          const k = `${row.category.toLowerCase()}:::${row.value.trim().toLowerCase()}:::${(row.parentValue || "").trim().toLowerCase()}`;
          existingMap.set(k, row);
        }

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const item of items) {
          const category = String(item.category || "").trim();
          const value = String(item.value || "").trim();
          const parentValue = item.parentValue ? String(item.parentValue).trim() : null;
          const extraValue = item.extraValue ? String(item.extraValue).trim() : null;
          const sortOrder = typeof item.sortOrder === "number" ? item.sortOrder : 0;

          if (!category || !value) {
            skippedCount++;
            continue;
          }

          const k = `${category.toLowerCase()}:::${value.toLowerCase()}:::${(parentValue || "").toLowerCase()}`;
          const existingRow = existingMap.get(k);

          const normExtra = extraValue ? extraValue.trim() : null;

          if (existingRow) {
            let needsUpdate = false;
            const updatePayload: Record<string, any> = {};
            const normExistingExtra = existingRow.extraValue ? String(existingRow.extraValue).trim() : null;

            if (normExtra !== null && normExtra !== normExistingExtra) {
              updatePayload.extraValue = normExtra;
              needsUpdate = true;
            }
            if (existingRow.disabled) {
              updatePayload.disabled = false;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await tenantDb
                .update(lookupValuesTable)
                .set(updatePayload)
                .where(eq(lookupValuesTable.id, existingRow.id));
              if (normExtra !== null) existingRow.extraValue = normExtra;
              existingRow.disabled = false;
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            const [created] = await tenantDb
              .insert(lookupValuesTable)
              .values({
                category,
                value,
                parentValue,
                extraValue: normExtra,
                sortOrder,
                disabled: false,
              } as any)
              .returning();

            existingMap.set(k, created);
            insertedCount++;
          }
        }

        return {
          success: true,
          insertedCount,
          updatedCount,
          skippedCount,
          total: items.length,
        };
      });

      broadcastToProperty(propertyId, { module: "settings", action: "updated" });
      res.json(result);
    } catch (err: any) {
      console.error("Error in /lookup-values/bulk:", err);
      res.status(500).json({ error: err.message || "Failed to bulk import lookup values" });
    }
  },
);

// ─── PATCH /lookup-values/:id ─────────────────────────────────────────────────
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

    const { value, parentValue, extraValue, disabled, sortOrder } = req.body;
    const updateData: Record<string, any> = {};

    if (value !== undefined) updateData.value = String(value);
    if (sortOrder !== undefined)
      updateData.sortOrder = parseInt(String(sortOrder));
    if (extraValue !== undefined) {
      updateData.extraValue = (extraValue === null || extraValue === "") ? null : String(extraValue);
    }
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

    broadcastToProperty(propertyId, { module: "settings", action: "updated" });
    res.json({ ...updated, propertyId });
  },
);

// ─── DELETE /lookup-values/:id ────────────────────────────────────────────────
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

    broadcastToProperty(propertyId, { module: "settings", action: "updated" });
    res.sendStatus(204);
  },
);

export default router;
