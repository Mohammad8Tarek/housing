// Morning Operations (Manager Flash) figures for one report date. Shared so the
// API can compute them (GET /api/reports/manager-flash) instead of the browser
// downloading the full stay history, every profile, ticket and reservation.
// Logic moved unchanged from ManagerFlashTab. Dates compare as "YYYY-MM-DD"
// strings, so the result does not depend on the runtime's time zone.
import { getProfileDisplayDepartment } from "./profile-display-utils";
import { formatNationality } from "./countries";

export interface ManagerFlashInput {
  ar: boolean;
  /** "YYYY-MM-DD" */
  reportDate: string;
  rooms: any[];
  buildings: any[];
  floors: any[];
  assignments: any[];
  reservations: any[];
  maintenance: any[];
  profiles: any[];
}

export function computeManagerFlash({
  ar,
  reportDate,
  rooms = [],
  buildings = [],
  floors = [],
  assignments = [],
  reservations = [],
  maintenance = [],
  profiles = [],
}: ManagerFlashInput) {
  // Operational metrics calculated for flash report
  const metrics = (() => {
    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce(
      (sum: number, r: any) => sum + (r.capacity || 1),
      0,
    );
    const occupiedBeds = rooms.reduce(
      (sum: number, r: any) => sum + (r.currentOccupancy || 0),
      0,
    );
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Room status categories
    const vacantClean = rooms.filter(
      (r: any) => r.status === "available",
    ).length;
    const vacantDirty = rooms.filter((r: any) => r.status === "dirty").length;
    const occupiedClean = rooms.filter(
      (r: any) => r.status === "occupied",
    ).length;
    const occupiedDirty = rooms.filter(
      (r: any) => r.status === "occupied_dirty",
    ).length;
    const occupiedVacation = rooms.filter(
      (r: any) => r.status === "occupied_vacation",
    ).length;
    const outOfOrder = rooms.filter((r: any) =>
      ["out_of_order", "ooo", "maintenance"].includes(r.status?.toLowerCase()),
    ).length;
    const outOfService = rooms.filter((r: any) =>
      ["out_of_service", "oos"].includes(r.status?.toLowerCase()),
    ).length;

    // Daily Movements (Based on reportDate)
    const arrivalsExpected = reservations.filter((res: any) => {
      if (res.status === "CANCELLED") return false;
      const d = res.checkInDate ? String(res.checkInDate).slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const arrivalsCheckedIn = reservations.filter((res: any) => {
      const d = res.checkInDate ? String(res.checkInDate).slice(0, 10) : "";
      return d === reportDate && res.status === "CHECKED_IN";
    }).length;

    const departuresExpected = assignments.filter((a: any) => {
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return false;
      const d = a.checkOutDate ? String(a.checkOutDate).slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const departuresCheckedOut = assignments.filter((a: any) => {
      const d = a.checkOutDate ? String(a.checkOutDate).slice(0, 10) : "";
      return (
        d === reportDate && (a.status === "CHECKED_OUT" || a.status === "LEFT")
      );
    }).length;

    const inHouseActive = assignments.filter(
      (a: any) => a.status === "ACTIVE" || a.status === "VACATION",
    ).length;

    const vacationResidents = assignments.filter(
      (a: any) => a.status === "VACATION",
    ).length;

    const roomTransfers = assignments.filter((a: any) => {
      const d = a.updatedAt ? String(a.updatedAt).slice(0, 10) : "";
      return d === reportDate && a.status === "TRANSFERRED";
    }).length;

    const openTickets = maintenance.filter(
      (t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS",
    ).length;

    return {
      totalRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      vacantClean,
      vacantDirty,
      occupiedClean,
      occupiedDirty,
      occupiedVacation,
      outOfOrder,
      outOfService,
      arrivalsExpected,
      arrivalsCheckedIn,
      departuresExpected,
      departuresCheckedOut,
      inHouseActive,
      vacationResidents,
      roomTransfers,
      openTickets,
      totalProfiles: profiles.length,
    };
  })();

  // Building Capacity Breakdown
  const buildingBreakdown = buildings.map((b: any) => {
    const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
    const totalRooms = bRooms.length;
    const totalBeds = bRooms.reduce(
      (acc: number, r: any) => acc + (r.capacity || 1),
      0,
    );
    const occupiedBeds = bRooms.reduce(
      (acc: number, r: any) => acc + (r.currentOccupancy || 0),
      0,
    );
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const dirtyCount = bRooms.filter(
      (r: any) => r.status === "dirty" || r.status === "occupied_dirty",
    ).length;
    const oooCount = bRooms.filter((r: any) =>
      ["out_of_order", "out_of_service", "maintenance", "ooo", "oos"].includes(
        r.status?.toLowerCase(),
      ),
    ).length;
    const occPercent =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      id: b.id,
      name: b.name || `مبنى #${b.id}`,
      code: b.code || "—",
      floorsCount: floors.filter((f: any) => f.buildingId === b.id).length,
      totalRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      dirtyCount,
      oooCount,
      occPercent,
    };
  });

  // Top Departments breakdown
  const departmentBreakdown = (() => {
    const deptCounts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const dept = ar
        ? getProfileDisplayDepartment(p, true)
        : p.department?.trim() || "Unassigned";
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    const total = profiles.length || 1;
    return Object.entries(deptCounts)
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  })();

  // Top Nationalities breakdown
  const nationalityBreakdown = (() => {
    const natCounts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const rawNat = p.nationality?.trim();
      const nat = ar
        ? formatNationality(rawNat, true, false) || "غير مسجل"
        : rawNat || "Other";
      natCounts[nat] = (natCounts[nat] || 0) + 1;
    });

    const total = profiles.length || 1;
    return Object.entries(natCounts)
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();

  return {
    metrics,
    buildingBreakdown,
    departmentBreakdown,
    nationalityBreakdown,
  };
}

export type ManagerFlash = ReturnType<typeof computeManagerFlash>;
