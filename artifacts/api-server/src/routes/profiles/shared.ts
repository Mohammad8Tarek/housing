// Helpers shared by the profiles route modules.
import { withTenant, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hasPermission } from "../../middlewares/permissions.js";
import { findProfileAcrossAllProperties } from "../../lib/cross-property-service.js";

export const MAX_PROFILE_LIST_ROWS = Number(
  process.env["API_MAX_PROFILE_LIST_ROWS"] ?? 2000,
);

export async function resolveProfileTenant(
  profileId: number,
  preferredPropertyId?: number,
): Promise<{ propertyId: number; profile: any } | null> {
  if (preferredPropertyId && preferredPropertyId > 0) {
    try {
      const [found] = await withTenant(preferredPropertyId, async (tenantDb) => {
        return tenantDb
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.id, profileId))
          .limit(1);
      });
      if (found) return { propertyId: preferredPropertyId, profile: found };
    } catch {}
  }
  return await findProfileAcrossAllProperties(profileId);
}

// Fields considered personally identifiable / sensitive
const SENSITIVE_FIELDS = [
  "nationalId",
  "national_id",
  "phone",
  "address",
  "idImage",
  "id_image",
  "photoUrl",
  "photo_url",
];

export function filterSensitive(
  records: Record<string, any> | Record<string, any>[],
  req: any,
): Record<string, any> | Record<string, any>[] {
  const authUser = (req as any).authUser;
  const canView =
    authUser && hasPermission(authUser, "profiles", "view_sensitive");
  if (canView) return records;

  const mask = (obj: Record<string, any>) => {
    const out = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (field in out && out[field]) out[field] = "***";
    }
    return out;
  };

  return Array.isArray(records) ? records.map(mask) : mask(records);
}

export const MAX_PHOTO_DATA_LENGTH = Number(
  process.env["PROFILE_PHOTO_MAX_DATA_LENGTH"] ?? 3 * 1024 * 1024,
);

export const PHOTO_DATA_RE =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function normalizePhotoData(value: unknown): string | null {
  if (value == null || value === "") return null;
  const photo = String(value);
  if (photo.length > MAX_PHOTO_DATA_LENGTH) {
    throw new Error("Photo is too large");
  }
  if (!PHOTO_DATA_RE.test(photo)) {
    throw new Error("Photo must be a PNG, JPG, WEBP, or GIF image");
  }
  return photo;
}
