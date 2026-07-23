import { Router } from "express";
import { z } from "zod/v4";
import { pool } from "@workspace/db";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getHotekStatus } from "../lib/pms-server.js";
import { isIpReachable } from "../utils/ping.js";

const router: Router = Router();

const HotekServerBody = z.object({
  propertyId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).default("Hotek Smart Server"),
  host: z.string().trim().min(1).default("127.0.0.1"),
  port: z.coerce.number().int().min(1).max(65535).default(10003),
  protocol: z.enum(["fidelio"]).default("fidelio"),
  workstation: z.string().trim().min(1).default("WS1"),
  serverCode: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

const HotekServerPatchBody = HotekServerBody.partial().extend({
  propertyId: z.coerce.number().int().positive(),
});

function toIso(value: unknown): string | null {
  return value instanceof Date
    ? value.toISOString()
    : value
      ? String(value)
      : null;
}

function toServer(row: Record<string, any>) {
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    name: row.name,
    host: row.host,
    port: Number(row.port),
    protocol: row.protocol,
    workstation: row.workstation,
    serverCode: row.server_code,
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    lastSeenAt: toIso(row.last_seen_at),
    lastSuccessAt: toIso(row.last_success_at),
    lastError: row.last_error,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function loadServers(propertyId: number) {
  const serversRes = await pool.query(
    `SELECT * FROM public.property_hotek_servers WHERE property_id = $1 ORDER BY is_default DESC, id ASC`,
    [propertyId],
  );
  return serversRes.rows.map((row) => toServer(row));
}

router.get(
  "/config",
  requirePermission("settings", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const servers = await loadServers(propertyId);
      res.json({ success: true, propertyId, servers });
    } catch (err: any) {
      console.error("[hotek/config] Error:", err.message);
      res.status(500).json({ error: "Failed to load Hotek configuration" });
    }
  },
);

router.post(
  "/servers",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const parsed = HotekServerBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (data.isDefault) {
        await client.query(
          `UPDATE public.property_hotek_servers SET is_default = false, updated_at = NOW() WHERE property_id = $1`,
          [data.propertyId],
        );
      }

      const result = await client.query(
        `INSERT INTO public.property_hotek_servers
        (property_id, name, host, port, protocol, workstation, server_code, is_active, is_default, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
        [
          data.propertyId,
          data.name,
          data.host,
          data.port,
          data.protocol,
          data.workstation,
          data.serverCode || null,
          data.isActive,
          data.isDefault,
        ],
      );
      await client.query("COMMIT");

      const s = su(req);
      await logActivity({
        req,
        propertyId: data.propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: "Create Hotek Smart Server",
        actionType: "CREATE",
        module: "hotek",
        entityType: "property_hotek_server",
        entityId: result.rows[0].id,
      });

      res.status(201).json({ success: true, server: toServer(result.rows[0]) });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[hotek/servers/post] Error:", err.message);
      res.status(500).json({ error: "Failed to create Hotek server" });
    } finally {
      client.release();
    }
  },
);

router.patch(
  "/servers/:id",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const parsed = HotekServerPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const id = Number(req.params.id);
    const data = parsed.data;
    const fields: Record<string, unknown> = {};
    if (data.name !== undefined) fields.name = data.name;
    if (data.host !== undefined) fields.host = data.host;
    if (data.port !== undefined) fields.port = data.port;
    if (data.protocol !== undefined) fields.protocol = data.protocol;
    if (data.workstation !== undefined) fields.workstation = data.workstation;
    if (data.serverCode !== undefined)
      fields.server_code = data.serverCode || null;
    if (data.isActive !== undefined) fields.is_active = data.isActive;
    if (data.isDefault !== undefined) fields.is_default = data.isDefault;

    if (Object.keys(fields).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (data.isDefault) {
        await client.query(
          `UPDATE public.property_hotek_servers SET is_default = false, updated_at = NOW() WHERE property_id = $1`,
          [data.propertyId],
        );
      }

      const values = Object.values(fields);
      const setSql = Object.keys(fields)
        .map((key, idx) => `${key} = $${idx + 3}`)
        .join(", ");
      const result = await client.query(
        `UPDATE public.property_hotek_servers
       SET ${setSql}, updated_at = NOW()
       WHERE id = $1 AND property_id = $2
       RETURNING *`,
        [id, data.propertyId, ...values],
      );
      await client.query("COMMIT");

      if (!result.rows[0]) {
        res.status(404).json({ error: "Hotek server not found" });
        return;
      }
      // Restart TCP Server if port or active status changed
      if (data.port !== undefined || data.isActive !== undefined) {
        const { stopPmsServerForProperty, startPmsServerForProperty } =
          await import("../lib/pms-server.js");
        stopPmsServerForProperty(data.propertyId);
        const serverRow = result.rows[0];
        if (serverRow.is_active) {
          startPmsServerForProperty(data.propertyId, serverRow.port);
        }
      }

      res.json({ success: true, server: toServer(result.rows[0]) });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[hotek/servers/patch] Error:", err.message);
      res.status(500).json({ error: "Failed to update Hotek server" });
    } finally {
      client.release();
    }
  },
);

router.post(
  "/servers/:id/test",
  requirePermission("settings", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const id = Number(req.params.id);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM public.property_hotek_servers WHERE id = $1 AND property_id = $2`,
        [id, propertyId],
      );
      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: "Hotek server not found" });
        return;
      }

      const status = getHotekStatus(propertyId);
      const test = {
        ok: status.connected,
        message: status.connected
          ? `Hotek connected from ${status.remoteAddress ?? "remote endpoint"}`
          : "PMS Bridge is online and waiting for Hotek PMSServer",
      };
      await pool.query(
        `UPDATE public.property_hotek_servers
       SET last_seen_at = NOW(),
           last_success_at = CASE WHEN $3 THEN NOW() ELSE last_success_at END,
           last_error = CASE WHEN $3 THEN NULL ELSE $4 END,
           updated_at = NOW()
       WHERE id = $1 AND property_id = $2`,
        [id, propertyId, test.ok, test.ok ? null : test.message],
      );

      res.json({
        success: test.ok,
        connected: status.connected,
        remoteAddress: status.remoteAddress ?? null,
        message: test.message,
      });
    } catch (err: any) {
      console.error("[hotek/servers/test] Error:", err.message);
      res.status(500).json({ error: "Failed to test Hotek server" });
    }
  },
);

router.delete(
  "/servers/:id",
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    const propertyId = Number(req.body?.propertyId ?? req.query.propertyId);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM public.property_hotek_encoders WHERE server_id = $1 AND property_id = $2`,
        [id, propertyId],
      );
      const result = await client.query(
        `DELETE FROM public.property_hotek_servers WHERE id = $1 AND property_id = $2 RETURNING id`,
        [id, propertyId],
      );
      await client.query("COMMIT");
      if (!result.rows[0]) {
        res.status(404).json({ error: "Server not found" });
        return;
      }
      res.json({ success: true, deleted: id });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[hotek/servers/delete] Error:", err.message);
      res.status(500).json({ error: "Failed to delete server" });
    } finally {
      client.release();
    }
  },
);

export default router;
