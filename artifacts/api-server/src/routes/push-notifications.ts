/**
 * push-notifications.ts — Push delivery for the resident portal.
 *
 * Two transports, both per-tenant:
 *   - Web Push (VAPID)      → push_subscriptions  (PWA / browser)
 *   - Native FCM (HTTP v1)  → device_tokens       (Capacitor Android / iOS)
 *
 * Exports sendPushToProperty / sendPushToProfiles used by notifications & chat.
 */
import { Router } from "express";
import webPush from "web-push";
import {
  withTenant,
  pushSubscriptionsTable,
  deviceTokensTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requirePortalAuth, portalSession } from "./portal-auth/shared.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";
import { validate } from "../middlewares/validate.js";
import {
  PushSubscribeBody,
  PushUnsubscribeBody,
  RegisterDeviceBody,
  UnregisterDeviceBody,
  PushTestBody,
} from "../validation/schemas.js";
import { isFcmConfigured, sendFcmToToken } from "../lib/fcm-service.js";
import { getVapidConfig, isWebPushReady } from "../lib/vapid-config.js";
import { logger } from "../lib/logger.js";

const router: Router = Router();

/** A dead token is dropped after this many consecutive non-fatal failures. */
const MAX_TOKEN_FAILURES = 5;

export interface PushPayload {
  title: string;
  titleAr?: string;
  body: string;
  bodyAr?: string;
  icon?: string;
  url?: string;
  tag?: string;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /push/vapid-key — Return VAPID public key for the PWA. Provisions the
// key pair on first call if it does not exist yet.
router.get("/vapid-key", async (_req, res) => {
  const cfg = await getVapidConfig();
  res.json({
    success: !!cfg,
    publicKey: cfg?.publicKey ?? null,
    fcm: isFcmConfigured(),
  });
});

// ─── Admin: push configuration status & test send ────────────────────────────

// GET /push/admin/status — configuration + reach for the active property.
router.get(
  "/admin/status",
  requirePermission("portal_notifications", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    const cfg = await getVapidConfig();
    let subscriptions = 0;
    let devices = 0;
    if (propertyId) {
      try {
        await withTenant(propertyId, async (tenantDb) => {
          const [s] = await tenantDb
            .select({ c: sql`count(*)`.mapWith(Number) })
            .from(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.propertyId, propertyId));
          const [d] = await tenantDb
            .select({ c: sql`count(*)`.mapWith(Number) })
            .from(deviceTokensTable)
            .where(eq(deviceTokensTable.propertyId, propertyId));
          subscriptions = s?.c ?? 0;
          devices = d?.c ?? 0;
        });
      } catch {
        /* counts are best-effort */
      }
    }
    res.json({
      webPush: !!cfg,
      vapidPublicKey: cfg?.publicKey ?? null,
      vapidSource: process.env.VAPID_PUBLIC_KEY
        ? "env"
        : cfg
          ? "generated"
          : "none",
      fcm: isFcmConfigured(),
      subscriptions,
      devices,
    });
  },
);

// POST /push/admin/test — send a test notification to one profile's devices.
router.post(
  "/admin/test",
  requirePermission("portal_notifications", "create"),
  validate({ body: PushTestBody }),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }
    const profileId = Number(req.body.profileId);
    if (!profileId) {
      res.status(400).json({ error: "profileId is required" });
      return;
    }
    await sendPushToProfiles(propertyId, [profileId], {
      title: req.body.title || "Sunrise Housing",
      titleAr: req.body.title || "سكن صن رايز",
      body: req.body.body || "This is a test notification ✅",
      bodyAr: req.body.body || "ده إشعار تجريبي للتأكد إن الإشعارات شغّالة ✅",
      url: "/dashboard",
      tag: "push-test",
    });
    res.json({ success: true });
  },
);

// POST /push/subscribe — Register a Web Push subscription
router.post(
  "/subscribe",
  requirePortalAuth,
  validate({ body: PushSubscribeBody }),
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const { endpoint, p256dhKey, authKey } = req.body;
      const userAgent = (req.headers["user-agent"] as string) || "";

      await withTenant(sess.propertyId, async (tenantDb) => {
        await tenantDb
          .insert(pushSubscriptionsTable)
          .values({
            profileId: sess.profileDbId,
            propertyId: sess.propertyId,
            endpoint,
            p256dhKey,
            authKey,
            userAgent,
          })
          .onConflictDoUpdate({
            target: pushSubscriptionsTable.endpoint,
            set: {
              profileId: sess.profileDbId,
              p256dhKey,
              authKey,
              userAgent,
              lastUsedAt: new Date(),
            },
          });
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /push/unsubscribe — Remove a Web Push subscription
router.post(
  "/unsubscribe",
  requirePortalAuth,
  validate({ body: PushUnsubscribeBody }),
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const { endpoint } = req.body;

      await withTenant(sess.propertyId, async (tenantDb) => {
        await tenantDb
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.endpoint, endpoint));
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// POST /push/register-device — Persist a native FCM token (Capacitor app)
router.post(
  "/register-device",
  requirePortalAuth,
  validate({ body: RegisterDeviceBody }),
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const { token, platform, deviceName } = req.body;
      const userAgent = (req.headers["user-agent"] as string) || "";

      await withTenant(sess.propertyId, async (tenantDb) => {
        await tenantDb
          .insert(deviceTokensTable)
          .values({
            profileId: sess.profileDbId,
            propertyId: sess.propertyId,
            token,
            platform,
            deviceName: deviceName ?? null,
            userAgent,
          })
          .onConflictDoUpdate({
            target: deviceTokensTable.token,
            // A token always belongs to the most recent account that logged in on the device.
            set: {
              profileId: sess.profileDbId,
              propertyId: sess.propertyId,
              platform,
              deviceName: deviceName ?? null,
              userAgent,
              failureCount: 0,
              lastUsedAt: new Date(),
            },
          });
      });

      res.json({ success: true, fcm: isFcmConfigured() });
    } catch (err) {
      next(err);
    }
  },
);

// POST /push/unregister-device — Remove a native FCM token (logout)
router.post(
  "/unregister-device",
  requirePortalAuth,
  validate({ body: UnregisterDeviceBody }),
  async (req, res, next) => {
    try {
      const sess = portalSession(req)!;
      const { token } = req.body;

      await withTenant(sess.propertyId, async (tenantDb) => {
        await tenantDb
          .delete(deviceTokensTable)
          .where(
            and(
              eq(deviceTokensTable.token, token),
              eq(deviceTokensTable.profileId, sess.profileDbId),
            ),
          );
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Delivery helpers ────────────────────────────────────────────────────────

function buildWebPayload(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.titleAr || payload.title,
    body: payload.bodyAr || payload.body,
    icon: payload.icon || "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: payload.tag || "sunrise-notification",
    data: { url: payload.url || "/dashboard" },
  });
}

type TenantDb = Parameters<Parameters<typeof withTenant>[1]>[0];

async function deliverWebPush(
  tenantDb: TenantDb,
  subs: any[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (subs.length === 0 || !(await getVapidConfig()))
    return { sent: 0, failed: 0 };
  const body = buildWebPayload(payload);
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
          },
          body,
        );
        sent++;
        await tenantDb
          .update(pushSubscriptionsTable)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
      } catch (err: any) {
        failed++;
        // 404/410 = subscription expired, remove it
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await tenantDb
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
      }
    }),
  );
  return { sent, failed };
}

async function deliverNativePush(
  tenantDb: TenantDb,
  tokens: any[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!isFcmConfigured() || tokens.length === 0) return { sent: 0, failed: 0 };
  const fcmPayload = {
    title: payload.titleAr || payload.title,
    body: payload.bodyAr || payload.body,
    url: payload.url,
    tag: payload.tag,
  };
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    tokens.map(async (row) => {
      const outcome = await sendFcmToToken(row.token, fcmPayload);
      if (outcome.ok) {
        sent++;
        await tenantDb
          .update(deviceTokensTable)
          .set({ lastUsedAt: new Date(), failureCount: 0 })
          .where(eq(deviceTokensTable.id, row.id));
        return;
      }
      failed++;
      if (
        outcome.unregistered ||
        (row.failureCount ?? 0) + 1 >= MAX_TOKEN_FAILURES
      ) {
        await tenantDb
          .delete(deviceTokensTable)
          .where(eq(deviceTokensTable.id, row.id));
      } else {
        await tenantDb
          .update(deviceTokensTable)
          .set({ failureCount: sql`${deviceTokensTable.failureCount} + 1` })
          .where(eq(deviceTokensTable.id, row.id));
      }
    }),
  );
  return { sent, failed };
}

async function dispatch(
  propertyId: number,
  payload: PushPayload,
  profileIds?: number[],
): Promise<void> {
  const webReady = await isWebPushReady();
  if (!webReady && !isFcmConfigured()) return;
  if (profileIds && profileIds.length === 0) return;

  try {
    await withTenant(propertyId, async (tenantDb) => {
      const subWhere = profileIds
        ? and(
            eq(pushSubscriptionsTable.propertyId, propertyId),
            inArray(pushSubscriptionsTable.profileId, profileIds),
          )
        : eq(pushSubscriptionsTable.propertyId, propertyId);
      const tokenWhere = profileIds
        ? and(
            eq(deviceTokensTable.propertyId, propertyId),
            inArray(deviceTokensTable.profileId, profileIds),
          )
        : eq(deviceTokensTable.propertyId, propertyId);

      const [subs, tokens] = await Promise.all([
        webReady
          ? tenantDb.select().from(pushSubscriptionsTable).where(subWhere)
          : Promise.resolve([]),
        isFcmConfigured()
          ? tenantDb.select().from(deviceTokensTable).where(tokenWhere)
          : Promise.resolve([]),
      ]);

      const [web, native] = await Promise.all([
        deliverWebPush(tenantDb, subs, payload),
        deliverNativePush(tenantDb, tokens, payload),
      ]);

      if (web.failed || native.failed) {
        logger.warn(
          { propertyId, web, native, tag: payload.tag },
          "[push] delivery completed with failures",
        );
      }
    });
  } catch (err) {
    logger.error({ err, propertyId }, "[push] dispatch error");
  }
}

/** Send to every subscribed device of a property. */
export async function sendPushToProperty(
  propertyId: number,
  payload: PushPayload,
  _departmentFilter?: string,
): Promise<void> {
  await dispatch(propertyId, payload);
}

/** Send to the devices of specific profiles. */
export async function sendPushToProfiles(
  propertyId: number,
  profileIds: number[],
  payload: PushPayload,
): Promise<void> {
  await dispatch(propertyId, payload, profileIds);
}

export default router;
