/**
 * fcm-service.ts — Firebase Cloud Messaging (HTTP v1) sender.
 *
 * Uses a Google service account (FIREBASE_SERVICE_ACCOUNT_JSON or
 * FIREBASE_SERVICE_ACCOUNT_PATH) and signs the OAuth2 JWT with node:crypto,
 * so no firebase-admin dependency is needed. Access tokens are cached until
 * shortly before expiry.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { logger } from "./logger.js";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface FcmMessagePayload {
  title: string;
  body: string;
  /** Opened when the notification is tapped (relative portal URL). */
  url?: string;
  /** Collapse key / channel tag. */
  tag?: string;
  /** Extra string data forwarded to the app. */
  data?: Record<string, string>;
}

export type FcmSendOutcome =
  | { ok: true }
  | { ok: false; unregistered: boolean; error: string };

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

let serviceAccount: ServiceAccount | null | undefined;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (serviceAccount !== undefined) return serviceAccount;
  try {
    const raw =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      (process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8")
        : "");
    if (!raw) {
      serviceAccount = null;
      logger.warn("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON/PATH not set — native push disabled");
      return null;
    }
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("service account is missing project_id, client_email or private_key");
    }
    // Env files often store the key with literal "\n" sequences.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    serviceAccount = parsed;
    return parsed;
  } catch (err: any) {
    serviceAccount = null;
    logger.error({ err: err?.message }, "[fcm] Failed to load service account — native push disabled");
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return loadServiceAccount() !== null;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.token;
  }

  const tokenUri = sa.token_uri || DEFAULT_TOKEN_URI;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) };
  return json.access_token;
}

/** Error codes that mean the token is dead and must be deleted. */
const UNREGISTERED_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"]);

/**
 * Sends one notification to one device token.
 * Never throws — returns an outcome so callers can prune dead tokens.
 */
export async function sendFcmToToken(token: string, payload: FcmMessagePayload): Promise<FcmSendOutcome> {
  const sa = loadServiceAccount();
  if (!sa) return { ok: false, unregistered: false, error: "fcm_not_configured" };

  try {
    const accessToken = await getAccessToken(sa);
    const data: Record<string, string> = {
      url: payload.url || "/dashboard",
      tag: payload.tag || "sunrise-notification",
      ...(payload.data || {}),
    };
    const message = {
      token,
      notification: { title: payload.title, body: payload.body },
      data,
      android: {
        priority: "high",
        collapse_key: payload.tag || undefined,
        notification: { channel_id: "sunrise_default", sound: "default", click_action: "FCM_PLUGIN_ACTIVITY" },
      },
      apns: {
        payload: { aps: { sound: "default", "thread-id": payload.tag || "sunrise" } },
      },
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (res.ok) return { ok: true };

    let errorCode = `HTTP_${res.status}`;
    try {
      const body = (await res.json()) as any;
      const details: any[] = body?.error?.details || [];
      const fcmDetail = details.find((d) => typeof d?.errorCode === "string");
      errorCode = fcmDetail?.errorCode || body?.error?.status || errorCode;
    } catch {
      /* non-JSON error body */
    }
    const unregistered = res.status === 404 || UNREGISTERED_CODES.has(errorCode);
    return { ok: false, unregistered, error: errorCode };
  } catch (err: any) {
    return { ok: false, unregistered: false, error: err?.message || "fcm_send_failed" };
  }
}

/** Test hook: clears cached credentials/tokens. */
export function _resetFcmCache(): void {
  serviceAccount = undefined;
  cachedAccessToken = null;
}
