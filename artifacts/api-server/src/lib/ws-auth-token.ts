import { createHmac, timingSafeEqual } from "node:crypto";

export type WsAuthTokenPayload = {
  userId: number;
  propertyId: number;
  username: string;
  isSystemAdmin: boolean;
  exp: number;
};

function getSecret(): string {
  const secret = process.env["WS_TOKEN_SECRET"] || process.env["SESSION_SECRET"];
  if (!secret) throw new Error("WS token secret is not configured");
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createWsAuthToken(
  payload: Omit<WsAuthTokenPayload, "exp">,
  ttlSeconds = 60,
): string {
  const body = encode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
  );
  return `${body}.${signPayload(body)}`;
}

export function verifyWsAuthToken(token: string): WsAuthTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = signPayload(body);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as WsAuthTokenPayload;
    if (!payload.userId || !payload.propertyId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
