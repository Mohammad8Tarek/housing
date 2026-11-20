/**
 * vapid-config.ts — resolves the Web Push (VAPID) key pair at runtime so push
 * notifications work out of the box, with no manual environment setup.
 *
 * Resolution order (first hit wins, then cached for the process):
 *   1. VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars (operator override).
 *   2. A key pair stored in public.app_config under key "vapid".
 *   3. Generate a fresh key pair, persist it once, and use it.
 *
 * The stored pair is stable: it is generated only when nothing exists and
 * inserted with ON CONFLICT DO NOTHING, so concurrent instances converge on a
 * single pair and existing browser subscriptions never break. The private key
 * lives only server-side (in the DB); only the public key is ever sent to the
 * browser.
 */
import webPush from "web-push";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  email: string;
}

const CONFIG_KEY = "vapid";

let cached: VapidConfig | null = null;
let detailsApplied = false;

function vapidEmail(): string {
  return process.env.VAPID_EMAIL || "mailto:sunrise-housing@example.com";
}

// Register the pair with the web-push library so sendNotification signs with
// it. Done once per process; safe to call repeatedly.
function applyDetails(cfg: VapidConfig): void {
  if (detailsApplied) return;
  try {
    webPush.setVapidDetails(cfg.email, cfg.publicKey, cfg.privateKey);
    detailsApplied = true;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[vapid] setVapidDetails failed");
  }
}

async function readStored(): Promise<VapidConfig | null> {
  const [row] = await db
    .select()
    .from(appConfigTable)
    .where(eq(appConfigTable.key, CONFIG_KEY))
    .limit(1);
  const v = row?.value as any;
  if (v?.publicKey && v?.privateKey) {
    return {
      publicKey: String(v.publicKey),
      privateKey: String(v.privateKey),
      email: v.email ? String(v.email) : vapidEmail(),
    };
  }
  return null;
}

/**
 * Resolve the active VAPID config, provisioning (generating + persisting) one
 * on first use if neither env nor the DB holds a pair. Returns null only if
 * the DB is unreachable and no env keys are set.
 */
export async function getVapidConfig(): Promise<VapidConfig | null> {
  if (cached) return cached;

  // 1. Environment override.
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      email: vapidEmail(),
    };
    applyDetails(cached);
    return cached;
  }

  try {
    // 2. Stored pair.
    const stored = await readStored();
    if (stored) {
      cached = stored;
      applyDetails(cached);
      return cached;
    }

    // 3. Generate + persist once. ON CONFLICT DO NOTHING means that if another
    //    instance inserted concurrently, we re-read and adopt the winning pair.
    const generated = webPush.generateVAPIDKeys();
    const value: VapidConfig = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      email: vapidEmail(),
    };
    await db
      .insert(appConfigTable)
      .values({
        key: CONFIG_KEY,
        value: value as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();

    const final = (await readStored()) ?? value;
    cached = final;
    applyDetails(cached);
    logger.info(
      "[vapid] provisioned a Web Push key pair (stored in public.app_config)",
    );
    return cached;
  } catch (err: any) {
    logger.warn(
      { err: err?.message },
      "[vapid] could not resolve VAPID config (web push disabled this boot)",
    );
    return null;
  }
}

/** True when a VAPID pair is available (web push can be sent). */
export async function isWebPushReady(): Promise<boolean> {
  return (await getVapidConfig()) !== null;
}

/** Drop the in-process cache (e.g. after rotating keys). */
export function invalidateVapidCache(): void {
  cached = null;
  detailsApplied = false;
}
