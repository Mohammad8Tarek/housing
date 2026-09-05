import { useMemo } from "react";

export function useReportAnalytics({
  ar = true,
  rooms = [],
  assignments = [],
  profiles = [],
  buildings = [],
  maintenance = [],
  reservations = [],
  hostings = [],
}: any) {
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const safeMaintenance = Array.isArray(maintenance) ? maintenance : [];
  const safeReservations = Array.isArray(reservations) ? reservations : [];

  const activeAssByRoom = useMemo(() => {
    const map = new Map<number, any[]>();
    safeAssignments
      .filter((a: any) => a.status?.toLowerCase() === "active")
      .forEach((a: any) => {
        if (!map.has(a.roomId)) map.set(a.roomId, []);
        map.get(a.roomId)!.push(a);
      });
    return map;
  }, [safeAssignments]);

  const getRoomOccupancy = (r: any): number => {
    const assList = activeAssByRoom.get(r.id) || [];
    const hasFullLock = assList.some(
      (a: any) =>
        a.isEntireRoom ||
        a.is_entire_room ||
        a.notes?.includes("[حجز الغرفة بالكامل]") ||
        a.notes?.includes("[تسكين الغرفة بالكامل]")
    );
    const cap = r.capacity ?? 1;
    if (hasFullLock) return cap;
    if (assList.length > 0) return Math.min(cap, assList.length);
    return Math.min(cap, r.currentOccupancy ?? 0);
  };

  const stats = useMemo(() => {
    const totalRooms = safeRooms.length;
    const totalCapacity = safeRooms.reduce((s: number, r: any) => s + (r.capacity ?? 1), 0);
    const totalOccupied = safeRooms.reduce((s: number, r: any) => s + getRoomOccupancy(r), 0);
    const vacantBeds = Math.max(0, totalCapacity - totalOccupied);
    const vacantRooms = safeRooms.filter(
      (r: any) =>
        (r.capacity ?? 1) > getRoomOccupancy(r) &&
        !["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(r.status?.toLowerCase()),
    ).length;
    const occupiedRooms = safeRooms.filter(
      (r: any) =>
        getRoomOccupancy(r) >= (r.capacity ?? 1) ||
        (r.status?.toLowerCase() === "occupied" && getRoomOccupancy(r) > 0),
    ).length;
    const maint = safeRooms.filter(
      (r: any) => ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(r.status?.toLowerCase()),
    ).length;
    const activeAss = safeAssignments.filter((a: any) => a.status?.toLowerCase() === "active").length;
    
    // Contract expiration within 30 days
    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(now.getDate() + 30);
    const expiringContracts = safeProfiles.filter((p: any) => {
      if (p.employmentType === "THIRD_PARTY" || !p.contractEndDate) return false;
      const d = new Date(p.contractEndDate);
      return d <= thirtyDaysAhead;
    }).length;

    const upcomingRes = safeReservations.filter((r: any) => r.status === "UPCOMING").length;

    return {
      totalRooms,
      vacantRooms,
      occupiedRooms,
      maint,
      totalCapacity,
      vacantBeds,
      totalOccupied,
      profiles: safeProfiles.length,
      activeAss,
      expiringContracts,
      upcomingRes,
    };
  }, [safeRooms, safeAssignments, safeProfiles, safeReservations, activeAssByRoom]);

  const analytics = useMemo(() => {
    const totalCapacity = stats.totalCapacity;
    const totalOccupied = stats.totalOccupied;
    const occRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    const byBuilding = safeBuildings
      .map((b: any) => {
        const bRooms = safeRooms.filter((r: any) => r.buildingId === b.id);
        const bCapacity = bRooms.reduce((s: number, r: any) => s + (r.capacity ?? 0), 0);
        const bOccupied = bRooms.reduce((s: number, r: any) => s + getRoomOccupancy(r), 0);
        const bAvail = bRooms.filter(
          (r: any) =>
            (r.capacity ?? 1) > getRoomOccupancy(r) &&
            !["maintenance", "out_of_service"].includes(r.status?.toLowerCase()),
        ).length;
        const bRate = bCapacity > 0 ? Math.round((bOccupied / bCapacity) * 100) : 0;
        return {
          id: b.id,
          name: b.name,
          totalRooms: bRooms.length,
          occupied: bRooms.filter((r: any) => getRoomOccupancy(r) > 0).length,
          availableRooms: bAvail,
          capacity: bCapacity,
          currentOccupancy: bOccupied,
          rate: bRate,
        };
      })
      .sort((a: any, b: any) => b.rate - a.rate);

    const typeMap: Record<string, { cap: number; occ: number; count: number }> = {};
    safeRooms.forEach((r: any) => {
      const t = r.roomType ?? "Standard";
      if (!typeMap[t]) typeMap[t] = { cap: 0, occ: 0, count: 0 };
      typeMap[t].cap += r.capacity ?? 0;
      typeMap[t].occ += getRoomOccupancy(r);
      typeMap[t].count += 1;
    });
    const byType = Object.entries(typeMap)
      .map(([type, d]) => ({
        type,
        rooms: d.count,
        capacity: d.cap,
        occupied: d.occ,
        rate: d.cap > 0 ? Math.round((d.occ / d.cap) * 100) : 0,
      }))
      .sort((a: any, b: any) => b.rate - a.rate);

    const deptMap: Record<string, number> = {};
    const natMap: Record<string, number> = {};
    const genderMap: Record<string, number> = { male: 0, female: 0, mixed: 0 };

    safeAssignments
      .filter((a: any) => a.status?.toLowerCase() === "active")
      .forEach((a: any) => {
        const p = safeProfiles.find((prof: any) => prof.id === a.profileId);
        const dept = p?.department || (ar ? "عام" : "General");
        deptMap[dept] = (deptMap[dept] || 0) + 1;

        const nat = p?.nationality || (ar ? "غير محدد" : "Unspecified");
        natMap[nat] = (natMap[nat] || 0) + 1;

        const g = p?.gender === "F" ? "female" : "male";
        genderMap[g] = (genderMap[g] || 0) + 1;
      });

    const byDept = Object.entries(deptMap)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);

    const byNationality = Object.entries(natMap)
      .map(([nationality, count]) => ({ nationality, count }))
      .sort((a, b) => b.count - a.count);

    const byGender = [
      { gender: "male", count: genderMap.male },
      { gender: "female", count: genderMap.female },
    ];

    // Maintenance stats
    const openMaint = safeMaintenance.filter((m: any) => m.status?.toLowerCase() === "open").length;
    const inProg = safeMaintenance.filter((m: any) => m.status?.toLowerCase() === "in_progress").length;
    const ticketsByCategory = {
      maintenance: safeMaintenance.filter((m: any) => m.category?.toLowerCase() === "maintenance" || m.category?.toLowerCase() === "plumbing" || m.category?.toLowerCase() === "electrical").length,
      housekeeping: safeMaintenance.filter((m: any) => m.category?.toLowerCase() === "housekeeping").length,
      general: safeMaintenance.filter((m: any) => !["maintenance", "housekeeping", "plumbing", "electrical"].includes(m.category?.toLowerCase())).length,
    };

    // History mock
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"];
    const occupancyHistory = months.map((month, idx) => ({
      month,
      occupancy: Math.max(0, totalOccupied - (5 - idx) * 3),
    }));

    return {
      totalCapacity,
      totalOccupied,
      availableBeds: stats.vacantBeds,
      availableRooms: stats.vacantRooms,
      occupiedRooms: stats.occupiedRooms,
      maintRooms: stats.maint,
      occRate,
      byBuilding,
      byType,
      byDept,
      byNationality,
      byGender,
      openMaint,
      inProg,
      ticketsByCategory,
      topProfiles: [],
      occupancyHistory,
    };
  }, [safeRooms, safeAssignments, safeProfiles, safeBuildings, safeMaintenance, stats]);

  return { stats, analytics };
}
