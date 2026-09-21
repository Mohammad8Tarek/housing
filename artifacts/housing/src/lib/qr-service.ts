/**
 * QR Code Helper Service for Sunrise Staff Housing Rooms
 */

export function getRoomServiceUrl(propertyId: number, roomId: number): string {
  const origin = window.location.origin;
  return `${origin}/room-service?p=${propertyId}&r=${roomId}`;
}

export function getRoomQrImageUrl(
  propertyId: number,
  roomId: number,
  format: "dataurl" | "png" | "svg" = "png"
): string {
  const targetUrl = encodeURIComponent(getRoomServiceUrl(propertyId, roomId));
  return `/api/public/room-qr?propertyId=${propertyId}&roomId=${roomId}&format=${format}&targetUrl=${targetUrl}`;
}

export async function fetchRoomQrDataUrl(
  propertyId: number,
  roomId: number
): Promise<string> {
  const targetUrl = encodeURIComponent(getRoomServiceUrl(propertyId, roomId));
  const res = await fetch(
    `/api/public/room-qr?propertyId=${propertyId}&roomId=${roomId}&format=dataurl&targetUrl=${targetUrl}`
  );
  if (!res.ok) {
    throw new Error("Failed to generate QR code");
  }
  const data = await res.json();
  return data.qrDataUrl;
}
