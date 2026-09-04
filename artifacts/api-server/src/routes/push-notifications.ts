/**
 * push-notifications.ts — Web Push subscription + sending
 * Tables: push_subscriptions
 */
import { Router } from "express";
import webPush from "web-push";
import { withTenant, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePortalAuth, portalSession } from "./portal-auth.js";

const router: Router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL =
  process.env.VAPID_EMAIL || "mailto:sunrise-housing@example.com";

const isVapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (!isVapidConfigured) {
  console.warn(
    "[push-notifications] VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY not set — web push notifications disabled",
  );
} else {
  // Configure web-push
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// GET /push/vapid-key — Return VAPID public key for frontend
// @ts-ignore
router.get("/vapid-key", (_req, res) => {
  res.json({ success: isVapidConfigured, publicKey: VAPID_PUBLIC_KEY || null });
});

// POST /push/subscribe — Register push subscription
// @ts-ignore
router.post("/subscribe", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { endpoint, p256dhKey, authKey } = req.body;

    if (!endpoint || !p256dhKey || !authKey) {
      return res.status(400).json({
        success: false,
        message: "Missing endpoint, p256dhKey, or authKey",
      });
    }

    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .insert(pushSubscriptionsTable)
        .values({
          profileId: sess.profileDbId,
          propertyId: sess.propertyId,
          endpoint,
          p256dhKey,
          authKey,
          userAgent: (req.headers["user-agent"] as string) || "",
        })
        .onConflictDoUpdate({
          target: pushSubscriptionsTable.endpoint,
          set: {
            profileId: sess.profileDbId,
            p256dhKey,
            authKey,
            userAgent: (req.headers["user-agent"] as string) || "",
            lastUsedAt: new Date(),
          },
        });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /push/unsubscribe — Remove push subscription
// @ts-ignore
router.post("/unsubscribe", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res
        .status(400)
        .json({ success: false, message: "Missing endpoint" });
    }

    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.endpoint, endpoint));
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Helper: Send push notification to all profiles of a property ───
export async function sendPushToProperty(
  propertyId: number,
  payload: {
    title: string;
    titleAr?: string;
    body: string;
    bodyAr?: string;
    icon?: string;
    url?: string;
    tag?: string;
  },
  departmentFilter?: string,
) {
  if (!isVapidConfigured) return;
  try {
    await withTenant(propertyId, async (tenantDb) => {
      const subs = await tenantDb
        .select()
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.propertyId, propertyId));

      if (subs.length === 0) return;

      const notificationPayload = JSON.stringify({
        title: payload.titleAr || payload.title,
        body: payload.bodyAr || payload.body,
        icon: payload.icon || "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        tag: payload.tag || "sunrise-notification",
        data: { url: payload.url || "/dashboard" },
      });

      const results = await Promise.allSettled(
        subs.map(async (sub: any) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
              },
              notificationPayload,
            );
            // Update lastUsedAt
            await tenantDb
              .update(pushSubscriptionsTable)
              .set({ lastUsedAt: new Date() })
              .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
          } catch (err: any) {
            // 404/410 = subscription expired, remove it
            if (err.statusCode === 404 || err.statusCode === 410) {
              await tenantDb
                .delete(pushSubscriptionsTable)
                .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
            }
            throw err;
          }
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
    });
  } catch (err) {
    console.error("[push] sendPushToProperty error:", err);
  }
}

export default router;
