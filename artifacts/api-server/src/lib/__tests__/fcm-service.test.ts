import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  sendFcmToToken,
  isFcmConfigured,
  _resetFcmCache,
} from "../fcm-service.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const serviceAccount = JSON.stringify({
  project_id: "sunrise-test",
  client_email: "push@sunrise-test.iam.gserviceaccount.com",
  private_key: pem.replace(/\n/g, "\\n"), // stored with escaped newlines, like in .env
});

describe("fcm-service", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetFcmCache();
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccount;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    _resetFcmCache();
  });

  it("reports not configured when no credentials are present", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    _resetFcmCache();
    expect(isFcmConfigured()).toBe(false);
  });

  it("exchanges a signed JWT for an access token, caches it, and posts the message", async () => {
    const calls: Array<{ url: string; init: any }> = [];
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("oauth2")) {
        const body = init.body as URLSearchParams;
        expect(body.get("grant_type")).toContain("jwt-bearer");
        expect(body.get("assertion")!.split(".")).toHaveLength(3);
        return new Response(
          JSON.stringify({ access_token: "tok-1", expires_in: 3600 }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }) as any;

    expect(isFcmConfigured()).toBe(true);
    const r1 = await sendFcmToToken("device-abc", {
      title: "Hi",
      body: "Body",
      url: "/dashboard",
      tag: "t1",
    });
    const r2 = await sendFcmToToken("device-abc", {
      title: "Hi",
      body: "Body",
    });
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });

    // one token exchange, two sends
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
    const sends = calls.filter((c) => c.url.includes("fcm.googleapis.com"));
    expect(sends).toHaveLength(2);
    expect(sends[0].url).toContain("/projects/sunrise-test/messages:send");
    expect(sends[0].init.headers.Authorization).toBe("Bearer tok-1");
    const msg = JSON.parse(sends[0].init.body).message;
    expect(msg.token).toBe("device-abc");
    expect(msg.notification).toEqual({ title: "Hi", body: "Body" });
    expect(msg.data.url).toBe("/dashboard");
    expect(msg.android.notification.channel_id).toBe("sunrise_default");
  });

  it("flags UNREGISTERED tokens so callers can prune them", async () => {
    globalThis.fetch = vi.fn(async (url: any) => {
      if (String(url).includes("oauth2")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          error: {
            status: "NOT_FOUND",
            details: [{ errorCode: "UNREGISTERED" }],
          },
        }),
        { status: 404 },
      );
    }) as any;

    const r = await sendFcmToToken("dead", { title: "x", body: "y" });
    expect(r).toEqual({ ok: false, unregistered: true, error: "UNREGISTERED" });
  });

  it("does not treat transient errors as unregistered", async () => {
    globalThis.fetch = vi.fn(async (url: any) => {
      if (String(url).includes("oauth2")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ error: { status: "UNAVAILABLE" } }),
        { status: 503 },
      );
    }) as any;

    const r = await sendFcmToToken("alive", { title: "x", body: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.unregistered).toBe(false);
  });
});
