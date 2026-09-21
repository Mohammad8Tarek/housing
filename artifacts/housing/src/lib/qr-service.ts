import QRCode from "qrcode";

/**
 * In-memory cache for generated QR Data URLs to ensure zero-latency rendering
 */
const qrDataUrlCache = new Map<string, string>();

/**
 * Returns the public mobile landing page URL for a given room
 */
export function getRoomServiceUrl(propertyId: number, roomId: number): string {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:9000";
  return `${origin}/room-service?p=${propertyId}&r=${roomId}`;
}

/**
 * Generates a high-quality QR Code Data URL directly in the browser.
 * Caches results in memory so repeated views are instantaneous (0ms).
 */
export async function generateRoomQrDataUrl(
  propertyId: number,
  roomId: number,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const cacheKey = `${propertyId}:${roomId}:${options?.width || 500}`;
  if (qrDataUrlCache.has(cacheKey)) {
    return qrDataUrlCache.get(cacheKey)!;
  }

  const targetUrl = getRoomServiceUrl(propertyId, roomId);

  try {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: options?.width || 500,
      margin: options?.margin ?? 1,
      color: {
        dark: "#0F2A44",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });

    qrDataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("[QR Service] Failed to generate QR data URL client-side:", err);
    // Fallback to server endpoint
    return getRoomQrImageUrl(propertyId, roomId, "png");
  }
}

/**
 * Generates a QR Code as an SVG string for sharp vector printing
 */
export async function generateRoomQrSvg(
  propertyId: number,
  roomId: number
): Promise<string> {
  const targetUrl = getRoomServiceUrl(propertyId, roomId);
  return await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#0F2A44",
      light: "#FFFFFF",
    },
  });
}

/**
 * Returns the server-side generated image URL as a fallback
 */
export function getRoomQrImageUrl(
  propertyId: number,
  roomId: number,
  format: "dataurl" | "png" | "svg" = "png"
): string {
  const targetUrl = encodeURIComponent(getRoomServiceUrl(propertyId, roomId));
  return `/api/public/room-qr?propertyId=${propertyId}&roomId=${roomId}&format=${format}&targetUrl=${targetUrl}`;
}
