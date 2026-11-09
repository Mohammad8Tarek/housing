/**
 * SUNRISE Resorts & Cruises — corporate identity tokens (CI Manual 1-1-2023, Part 1).
 *
 * Use these for printed/exported documents and branded report surfaces.
 * Teal is the dominant colour; the rest are accents. Never recolour or
 * retype the logo — always use the official PNG in /public/brand.
 */
export const SR = {
  teal: "#2AA8AB",
  tealDark: "#1F7F81", // shade of brand teal for text on white (AA contrast)
  tealTint: "#E8F6F6", // 10% tint for zebra rows / soft panels
  sand: "#BC9F6F",
  sandTint: "#F7F2EA",
  magenta: "#D50058",
  red: "#A52D2C",
  orange: "#D7731B",
  green: "#41645A",
  turquoise: "#59B7A8",
  black: "#000000",
  white: "#FFFFFF",
  ink: "#1E2A2B", // body text
  muted: "#5F6B6C",
  rule: "#D9E3E3",
} as const;

/** Print: Gill Sans → Gill Sans MT → Lato. Arabic: Helvetica Neue LT Arabic → Noto Sans Arabic → Tahoma. */
export const SR_FONT_PRINT =
  "'Gill Sans', 'Gill Sans MT', 'Lato', 'Helvetica Neue', Arial, sans-serif";
export const SR_FONT_ARABIC =
  "'Helvetica Neue LT Arabic', 'Noto Sans Arabic', 'Cairo', Tahoma, sans-serif";

/** Official teal logo (transparent). Do not apply filters, shadows or stretching. */
export const SR_LOGO_TEAL = "/brand/sunrise-logo-teal.png";

/** Status → brand accent tone for print badges. */
export function srStatusTone(value: unknown): { fg: string; bg: string; border: string } {
  const s = String(value ?? "").toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => s.includes(k));
  if (has("out_of_service", "out_of_order", "صيانة", "rejected", "مرفوض", "cancelled", "ملغي", "overdue", "متأخر"))
    return { fg: SR.red, bg: "#F6E6E6", border: "#E0B4B3" };
  if (has("occupied", "مشغول", "dirty", "متسخ", "pending", "معلق", "vacation", "إجازة"))
    return { fg: "#9A4F0E", bg: "#FBEEE2", border: "#EFC7A2" };
  if (has("active", "نشط", "available", "vacant", "شاغر", "clean", "جاهز", "confirmed", "مؤكد", "returned", "عاد"))
    return { fg: SR.green, bg: "#E5EEEB", border: "#B5CBC4" };
  return { fg: SR.muted, bg: "#F1F4F4", border: SR.rule };
}
