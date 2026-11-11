// ════════════════════════════════════════════════════════════
// Row value resolution for report exports (dot-paths + common key aliases)
// ════════════════════════════════════════════════════════════

const COMMON_KEY_ALIASES: Record<string, string[]> = {
  occupantName: [
    "fullName",
    "profileName",
    "guestName",
    "name",
    "employeeName",
  ],
  guestName: ["fullName", "profileName", "occupantName", "name"],
  building: ["buildingName", "buildingCode"],
  buildingName: ["building", "buildingCode"],
  floor: ["floorName", "floorNumber"],
  floorName: ["floor", "floorNumber"],
  issueId: ["id", "ticketId"],
  issueDescription: ["problemType", "description", "notes"],
  problemType: ["issueDescription", "issue", "description"],
  resolutionStatus: ["status", "rawStatus"],
  reportedBy: ["reporter", "reportedByName", "createdBy"],
  assignedTo: ["workerName", "assignedToName", "technician"],
  occupancyStatus: ["status", "statusCategory"],
  roomNumber: ["room_number", "roomNo", "room"],
  bedNumber: ["bed_number", "bedNo"],
  checkInDate: ["check_in_date", "arrivalDate"],
  checkOutDate: ["check_out_date", "departureDate"],
  reportDate: ["date", "created_at", "createdAt"],
  property: ["propertyName", "hotelName"],
  daysInHouse: ["nights", "stayDays"],
  totalCapacity: ["capacity", "beds"],
  currentOccupants: ["occupiedCount", "occupiedBeds", "currentOccupancy"],
  vacantBeds: ["availableBeds", "vacantCount"],
  occupantsSummary: ["residentsSummary", "occupantsList"],
};

// Resolve dot-path keys: 'employee.name' → row.employee.name, with smart fallback to common aliases
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  if (!obj) return undefined;

  // Direct lookup first
  const direct = path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object")
      return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj as unknown);

  if (direct !== undefined && direct !== null) return direct;

  // Check aliases if direct is undefined/null
  const aliases = COMMON_KEY_ALIASES[path];
  if (aliases) {
    for (const alias of aliases) {
      const val = (obj as Record<string, unknown>)[alias];
      if (val !== undefined && val !== null) return val;
    }
  }

  return undefined;
}
