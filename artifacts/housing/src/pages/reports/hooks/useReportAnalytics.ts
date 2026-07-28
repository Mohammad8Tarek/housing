import { useMemo } from "react";

export function useReportAnalytics({
  rooms,
  assignments,
  employees,
  buildings,
  maintenance,
}: any) {
  const stats = useMemo(
    () => ({
      total: rooms.length,
      available: rooms.filter(
        (r: any) => r.status?.toLowerCase() === "available",
      ).length,
      occupied: rooms.filter((r: any) => r.status?.toLowerCase() === "occupied")
        .length,
      maint: rooms.filter((r: any) => r.status?.toLowerCase() === "maintenance")
        .length,
      employees: employees.length,
      activeAss: assignments.filter(
        (a: any) => a.status?.toLowerCase() === "active",
      ).length,
    }),
    [rooms, assignments, employees],
  );

  const analytics = useMemo(() => {
    const activeAssignments = assignments.filter(
      (a: any) => a.status?.toLowerCase() === "active",
    );
    const totalCapacity = rooms.reduce(
      (s: number, r: any) => s + (r.capacity ?? 0),
      0,
    );
    const totalOccupied = rooms.reduce(
      (s: number, r: any) => s + (r.currentOccupancy ?? 0),
      0,
    );
    const availableBeds = Math.max(0, totalCapacity - totalOccupied);
    const availableRooms = rooms.filter(
      (r: any) => r.status?.toLowerCase() === "available",
    ).length;
    const occupiedRooms = rooms.filter(
      (r: any) => r.status?.toLowerCase() === "occupied",
    ).length;
    const maintRooms = rooms.filter(
      (r: any) => r.status?.toLowerCase() === "maintenance",
    ).length;
    const occRate =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    const byBuilding = buildings
      .map((b: any) => {
        const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
        const bCapacity = bRooms.reduce(
          (s: number, r: any) => s + (r.capacity ?? 0),
          0,
        );
        const bOccupied = bRooms.reduce(
          (s: number, r: any) => s + (r.currentOccupancy ?? 0),
          0,
        );
        const bAvail = bRooms.filter(
          (r: any) => r.status?.toLowerCase() === "available",
        ).length;
        const bRate =
          bCapacity > 0 ? Math.round((bOccupied / bCapacity) * 100) : 0;
        return {
          id: b.id,
          name: b.name,
          totalRooms: bRooms.length,
          occupied: occupiedRooms,
          availableRooms: bAvail,
          capacity: bCapacity,
          currentOccupancy: bOccupied,
          rate: bRate,
        };
      })
      .sort((a: any, b: any) => b.rate - a.rate);

    const typeMap: Record<string, { cap: number; occ: number; count: number }> =
      {};
    rooms.forEach((r: any) => {
      const t = r.roomType ?? "Unknown";
      if (!typeMap[t]) typeMap[t] = { cap: 0, occ: 0, count: 0 };
      typeMap[t].cap += r.capacity ?? 0;
      typeMap[t].occ += r.currentOccupancy ?? 0;
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

    const genderMap: Record<string, number> = {};
    rooms.forEach((r: any) => {
      const g = r.genderPolicy ?? "any";
      genderMap[g] = (genderMap[g] ?? 0) + 1;
    });
    const byGender = Object.entries(genderMap).map(([g, cnt]) => ({
      gender: g,
      count: cnt,
    }));

    const deptMap: Record<string, number> = {};
    activeAssignments.forEach((a: any) => {
      const emp = employees.find((e: any) => e.id === a.employeeId);
      const dept = emp?.department ?? "Unknown";
      deptMap[dept] = (deptMap[dept] ?? 0) + 1;
    });
    const byDept = Object.entries(deptMap)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    const openMaint = maintenance.filter(
      (m: any) => m.status?.toLowerCase() === "open",
    ).length;
    const inProg = maintenance.filter(
      (m: any) => m.status?.toLowerCase() === "in_progress",
    ).length;

    const ticketsByCategory = {
      maintenance: maintenance.filter((m: any) => m.category === "maintenance")
        .length,
      housekeeping: maintenance.filter(
        (m: any) => m.category === "housekeeping",
      ).length,
      general: maintenance.filter((m: any) => m.category === "general").length,
    };

    const assignedCounts: Record<
      number,
      { empId: number; total: number; open: number; resolved: number }
    > = {};
    maintenance
      .filter((m: any) => m.assignedTo)
      .forEach((m: any) => {
        const a = m.assignedTo!;
        if (!assignedCounts[a])
          assignedCounts[a] = { empId: a, total: 0, open: 0, resolved: 0 };
        assignedCounts[a].total++;
        if (m.status === "open" || m.status === "in_progress")
          assignedCounts[a].open++;
        if (m.status === "resolved" || m.status === "closed")
          assignedCounts[a].resolved++;
      });
    const topEmployees = Object.values(assignedCounts)
      .sort((a: any, b: any) => b.resolved - a.resolved)
      .slice(0, 5)
      .map((a: any) => ({
        ...a,
        name: employees.find((e: any) => e.id === a.empId)
          ? `${employees.find((e: any) => e.id === a.empId)!.firstName} ${employees.find((e: any) => e.id === a.empId)!.lastName}`
          : `Emp #${a.empId}`,
      }));

    return {
      totalCapacity,
      totalOccupied,
      availableBeds,
      availableRooms,
      occupiedRooms,
      maintRooms,
      occRate,
      byBuilding,
      byType,
      byGender,
      byDept,
      openMaint,
      inProg,
      ticketsByCategory,
      topEmployees,
    };
  }, [rooms, assignments, employees, buildings, maintenance]);

  return { stats, analytics };
}
