// Per-property service catalogue for maintenance / housekeeping tickets:
// names (AR/EN), department and target minutes. Seeded with the defaults the
// first time a property reads it; cached in memory for ticket formatting.
import { asc } from "drizzle-orm";
import { maintenanceServicesTable, withTenant } from "@workspace/db";
import { SERVICE_TARGET_MINUTES } from "./maintenance-tickets.js";

export type ServiceCategory = "maintenance" | "housekeeping" | "general";

export interface ServiceDef {
  category: ServiceCategory;
  key: string;
  labelAr: string;
  labelEn: string;
  targetMinutes: number;
  active: boolean;
  sortOrder: number;
}

const D = (
  category: ServiceCategory,
  key: string,
  labelAr: string,
  labelEn: string,
): Omit<ServiceDef, "sortOrder"> => ({
  category,
  key,
  labelAr,
  labelEn,
  targetMinutes: SERVICE_TARGET_MINUTES[key] ?? 240,
  active: true,
});

/** The catalogue every property starts with (matches the admin UI's lists). */
export const DEFAULT_SERVICES: ServiceDef[] = [
  D("maintenance", "Plumbing", "سباكة", "Plumbing"),
  D("maintenance", "Electrical", "كهرباء", "Electrical"),
  D("maintenance", "HVAC", "تكييف وتبريد", "HVAC & AC"),
  D("maintenance", "Furniture", "أثاث ونجارة", "Furniture & Woodwork"),
  D("maintenance", "Internet", "إنترنت وشبكات", "Internet & Network"),
  D("maintenance", "Appliances", "أجهزة كهربائية", "Appliances"),
  D("maintenance", "Other", "أعطال أخرى", "Other Maintenance"),
  D("housekeeping", "room_cleaning", "تنظيف الغرفة", "Room Cleaning"),
  D("housekeeping", "bed_sheets", "تغيير المفارش والأسرة", "Bed Linen Change"),
  D("housekeeping", "towels", "مناشف ومستلزمات", "Towels & Amenities"),
  D("housekeeping", "deep_cleaning", "تنظيف شامل وعميق", "Deep Cleaning"),
  D("housekeeping", "waste_removal", "تفريغ المهملات", "Trash Removal"),
  D(
    "housekeeping",
    "sanitization",
    "تعقيم وتطهير",
    "Sanitization & Disinfection",
  ),
  D("housekeeping", "turnover", "تجهيز لنزيل جديد", "Turnover Preparation"),
  D("housekeeping", "other", "طلب نظافة آخر", "Special / Other Request"),
  D("general", "general_inquiry", "استفسار عام", "General Inquiry"),
  D("general", "inspection", "فحص ومعاينة", "Room Inspection"),
  D("general", "pest_control", "مكافحة حشرات", "Pest Control"),
  D("general", "other", "أخرى", "Other"),
].map((s, i) => ({ ...s, sortOrder: i }));

/** Read a property's catalogue, seeding the defaults when it is empty. */
export async function listServices(tenantDb: any) {
  let rows = await tenantDb
    .select()
    .from(maintenanceServicesTable)
    .orderBy(
      asc(maintenanceServicesTable.sortOrder),
      asc(maintenanceServicesTable.id),
    );
  if (rows.length === 0) {
    await tenantDb
      .insert(maintenanceServicesTable)
      .values(DEFAULT_SERVICES)
      .onConflictDoNothing();
    rows = await tenantDb
      .select()
      .from(maintenanceServicesTable)
      .orderBy(
        asc(maintenanceServicesTable.sortOrder),
        asc(maintenanceServicesTable.id),
      );
  }
  return rows;
}

type CatalogueEntry = {
  targetMinutes: number;
  labelAr: string;
  labelEn: string;
};
const cache = new Map<
  number,
  { at: number; byKey: Map<string, CatalogueEntry> }
>();
const TTL_MS = 5 * 60_000;

/**
 * The property's service catalogue keyed by problem type (cached 5 minutes).
 * Inactive services still resolve, so old tickets keep their names and targets.
 */
export async function loadServiceCatalogue(
  propertyId: number,
): Promise<Map<string, CatalogueEntry>> {
  const hit = cache.get(propertyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.byKey;
  try {
    const rows = await withTenant(propertyId, (tenantDb) =>
      listServices(tenantDb),
    );
    const byKey = new Map<string, CatalogueEntry>();
    // Maintenance first so a key shared across departments (e.g. "other")
    // resolves to the first definition.
    for (const r of rows as any[]) {
      if (!byKey.has(r.key)) {
        byKey.set(r.key, {
          targetMinutes: Number(r.targetMinutes) || 240,
          labelAr: r.labelAr,
          labelEn: r.labelEn,
        });
      }
    }
    cache.set(propertyId, { at: Date.now(), byKey });
    return byKey;
  } catch {
    return new Map(); // table not migrated yet: code defaults apply
  }
}

/** Synchronous lookup for formatting (warm with loadServiceCatalogue first). */
export function cachedService(
  propertyId: number | null | undefined,
  key: string | null | undefined,
): CatalogueEntry | undefined {
  if (!propertyId || !key) return undefined;
  return cache.get(Number(propertyId))?.byKey.get(String(key));
}

export function invalidateServiceCatalogue(propertyId: number): void {
  cache.delete(propertyId);
}

/** "Water Heater" -> "water_heater" (for new services). */
export function serviceKeyFrom(labelEn: string): string {
  const k = labelEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return k || `service_${Date.now().toString(36)}`;
}
