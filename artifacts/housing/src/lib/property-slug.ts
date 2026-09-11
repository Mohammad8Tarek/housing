export type PropertyInfo = {
  id: number;
  name: string;
  code: string;
  displayName?: string | null;
  status?: string;
  primaryColor?: string;
  defaultLanguage?: string;
};

export const RESERVED_FIRST_SEGMENTS = new Set([
  "login",
  "dashboard",
  "housing",
  "room-space-view",
  "profiles",
  "accommodation",
  "housekeeping",
  "maintenance",
  "reports",
  "users",
  "properties",
  "portal",
  "settings",
  "activity-log",
  "hosting-requests",
  "api",
  "assets",
  "favicon.ico",
]);

const KNOWN_SLUG_MAP: Record<string, number> = {
  taal_housing: 1,
  el_waha_new: 2,
  elwaha_old: 3,
};

export function getPropertySlug(
  prop?: { name?: string | null; code?: string | null; id?: number } | null,
): string {
  if (!prop) return "";
  if (prop.name) {
    const slug = prop.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (slug) return slug;
  }
  if (prop.code) {
    return prop.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }
  if (prop.id) return String(prop.id);
  return "";
}

export function findPropertyBySlug(
  properties: PropertyInfo[],
  slug: string,
): PropertyInfo | undefined {
  if (!slug) return undefined;
  const clean = slug.trim().toLowerCase();
  return properties.find((p) => {
    const pSlug = getPropertySlug(p);
    return (
      pSlug === clean ||
      p.name?.trim().toLowerCase() === clean ||
      p.code?.trim().toLowerCase() === clean ||
      String(p.id) === clean
    );
  });
}

export function extractPropertySlugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first || RESERVED_FIRST_SEGMENTS.has(first.toLowerCase())) {
    return null;
  }
  return first.toLowerCase();
}

export function resolveInitialPropertyId(pathSlug: string | null): number | "all" | undefined {
  if (!pathSlug) return undefined;
  const clean = pathSlug.trim().toLowerCase();
  if (clean === "all") return "all";
  if (KNOWN_SLUG_MAP[clean]) return KNOWN_SLUG_MAP[clean];
  if (!isNaN(Number(clean))) return Number(clean);
  return undefined;
}
