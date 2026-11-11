// Shared inputs and helpers for report row builders.
import { parseDMY } from "../date-utils";
import { normalizeSearchText } from "../search-utils";

export interface ReportProcessorContext {
  ar: any;
  activeTab: any;
  filterBuilding: any;
  filterFloor: any;
  filterStatus: any;
  filterCategory: any;
  inventoryViewMode: any;
  filterDepartment: any;
  filterGender: any;
  filterNationality: any;
  filterRoomType: any;
  filterEmploymentType: any;
  waterSortMode: any;
  search: any;
  dateFrom: any;
  dateTo: any;
  timeZone?: string;
  buildings: any;
  floors: any;
  rooms: any;
  profiles: any;
  assignments: any;
  reservations: any;
  maintenance: any;
  hostings: any;
  equipmentInventory: any;
  gateLogs: any;
  vacations: any;
  buildingMap: any;
  floorMap: any;
  roomMap: any;
  empMap: any;
  settings: any;
  filteredBuildingIds: Set<any>;
  filteredFloorIds: Set<any>;
  applySearchAndDate: (
    data: any[],
    dateField?: string,
    searchFields?: (item: any) => (string | number | null | undefined)[],
  ) => any[];
}

// Normalizes either "YYYY-MM-DD" or display "DD/MM/YYYY" (or "—"/"-")
// to a comparable "YYYY-MM-DD" string for range filtering.
export function comparableDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "—" || s === "-") return "";
  const fromDisplay = parseDMY(s);
  if (fromDisplay) return fromDisplay;
  return s.slice(0, 10);
}

export function normalizeItemName(name: string): string {
  return normalizeSearchText(name);
}

/**
 * Intelligent room type and capacity matching for reports.
 * Matches bed capacity (1, 2, 3, 4, 5, 6+) as well as specific room type strings (Deluxe, Suite, Single, Double, Triple, Quad, etc.)
 */
export function matchesRoomType(room: any, filterValue: string): boolean {
  if (!filterValue || filterValue === "all") return true;
  if (!room) return false;

  const rType = String(room.roomType || room.room_type || "")
    .trim()
    .toLowerCase();
  const cap = Number(room.capacity || room.bedCapacity || room.bedsCount || 0);
  const fVal = String(filterValue).trim().toLowerCase();

  // 1. Single / 1 Bed
  if (fVal === "1" || fVal === "single" || fVal === "cap:1") {
    return cap === 1 || rType.includes("single") || rType.includes("فردي");
  }

  // 2. Double / 2 Beds
  if (fVal === "2" || fVal === "double" || fVal === "cap:2") {
    return (
      cap === 2 ||
      rType.includes("double") ||
      rType.includes("دوبل") ||
      rType.includes("مزدوج") ||
      rType.includes("ثنائي")
    );
  }

  // 3. Triple / 3 Beds
  if (
    fVal === "3" ||
    fVal === "triple" ||
    fVal === "trible" ||
    fVal === "cap:3"
  ) {
    return (
      cap === 3 ||
      rType.includes("triple") ||
      rType.includes("trible") ||
      rType.includes("تريبل") ||
      rType.includes("ثلاثي")
    );
  }

  // 4. Quad / 4 Beds
  if (
    fVal === "4" ||
    fVal === "quad" ||
    fVal === "quadruple" ||
    fVal === "cap:4"
  ) {
    return (
      cap === 4 ||
      rType.includes("quad") ||
      rType.includes("رباعي") ||
      rType.includes("كوادروبل")
    );
  }

  // 5. 5 Beds
  if (fVal === "5" || fVal === "cap:5") {
    return cap === 5 || rType.includes("خماسي") || rType.includes("5");
  }

  // 6. 6+ Beds
  if (fVal === "6+" || fVal === "cap:6+" || fVal === "6") {
    return cap >= 6 || rType.includes("سداسي");
  }

  // 7. Specific Room Type Name matching (e.g. "Deluxe Room", "Family Suite", "Superior Room")
  if (rType === fVal) return true;
  if (rType && fVal && (rType.includes(fVal) || fVal.includes(rType)))
    return true;

  return false;
}

export function matchesGender(
  entityGender: string | null | undefined,
  filterGender: string,
): boolean {
  if (!filterGender || filterGender === "all") return true;
  const target = filterGender.toUpperCase().trim(); // "M" or "F"
  const val = String(entityGender || "")
    .trim()
    .toLowerCase();
  if (!val) return false;

  const isMale =
    val === "m" ||
    val === "male" ||
    val === "ذكر" ||
    val.includes("ذكور") ||
    val.includes("شباب");
  const isFemale =
    val === "f" ||
    val === "female" ||
    val === "إناث" ||
    val === "انثى" ||
    val === "بنات" ||
    val === "أنثى";

  if (target === "M") return isMale;
  if (target === "F") return isFemale;
  return true;
}
