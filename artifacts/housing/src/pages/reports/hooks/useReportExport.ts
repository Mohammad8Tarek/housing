import { exportExcel, exportPDF, exportAnalyticsPDF } from "../utils/export";
import { getGuestNames } from "../utils/helpers";

export function useReportExport({
  activeTab,
  canExportReports,
  currentData,
  properties,
  propId,
  activePropertyId,
  dateFrom,
  dateTo,
  search,
  settings,
  analytics,
  rooms,
  employees,
  evalStats,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
}: any) {
  const toExcelRows = (): Record<string, any>[] => {
    const data = currentData();
    switch (activeTab) {
      case "housing":
        return data.map((r: any) => ({
          "Room No": r.roomNumber,
          Type: r.roomType ?? "—",
          Capacity: r.capacity,
          Gender: r.genderPolicy ?? "—",
          Floor: floorMap[r.floorId] ?? r.floorId,
          Building: buildingMap[r.buildingId] ?? r.buildingId,
          Status: r.status,
        }));
      case "employees":
        return data.map((e: any) => ({
          Code: e.employeeCode,
          "First Name": e.firstName,
          "Last Name": e.lastName,
          "National ID": e.nationalId ?? "—",
          Nationality: e.nationality ?? "—",
          Phone: e.phone ?? "—",
          Gender: e.gender ?? "—",
          Department: e.department ?? "—",
          "Job Title": e.jobTitle ?? "—",
          Level: e.level ?? "—",
          "Hire Date": e.hireDate ?? "—",
          Address: e.address ?? "—",
          Status: e.status,
        }));
      case "assignments":
        return data.map((a: any) => {
          const emp = empMap[a.employeeId];
          const room = roomMap[a.roomId];
          return {
            Employee: emp
              ? `${emp.firstName} ${emp.lastName}`
              : `#${a.employeeId}`,
            "Room No": room?.roomNumber ?? `#${a.roomId}`,
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            "Check-In": a.checkInDate,
            "Expected Out": a.expectedCheckOutDate ?? "—",
            "Check-Out": a.checkOutDate ?? "—",
            Status: a.status,
          };
        });
      case "maintenance":
        return data.map((m: any) => {
          const room = roomMap[m.roomId];
          return {
            Category: m.category ?? "—",
            "Room No": room?.roomNumber ?? `#${m.roomId}`,
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            Problem: m.problemType,
            Priority: m.priority,
            Status: m.status,
            "Assigned To": m.assignedToName ?? "—",
            "Reported By": m.reportedBy ?? "—",
            Reported: m.reportedAt,
            Started: m.startedAt ?? "—",
            Resolved: m.resolvedAt ?? "—",
            "Due Date": m.dueDate ?? "—",
            Notes: m.notes ?? "—",
          };
        });
      case "reservations":
        return data.map((r: any) => ({
          Name: `${r.firstName} ${r.lastName}`,
          "Room No": r.roomId
            ? (roomMap[r.roomId]?.roomNumber ?? `#${r.roomId}`)
            : "—",
          "Room Type": r.roomType ?? "—",
          Department: r.department ?? "—",
          "Check-In": r.checkInDate,
          "Check-Out": r.checkOutDate ?? "—",
          Status: r.status,
        }));
      case "hostings":
        return data.map((h: any) => {
          const emp = empMap[h.employeeId];
          const room = h.roomId ? roomMap[h.roomId] : undefined;
          const names = getGuestNames(h);
          return {
            Employee: emp
              ? `${emp.firstName} ${emp.lastName}`
              : `#${h.employeeId}`,
            Code: emp?.employeeCode ?? "—",
            Dept: emp?.department ?? "—",
            Room: room?.roomNumber ?? (h.roomId ? `#${h.roomId}` : "—"),
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            Type: h.hostingType ?? "—",
            Guests: `${h.guestsCount ?? 0}${names !== "—" ? ` · ${names}` : ""}`,
            From: h.expectedFrom?.slice(0, 10) ?? "—",
            To: h.expectedTo?.slice(0, 10) ?? "—",
            "Check In": h.actualCheckIn?.slice(0, 10) ?? "—",
            "Check Out": h.actualCheckOut?.slice(0, 10) ?? "—",
            Status: h.status,
          };
        });
      default:
        return [];
    }
  };

  const handleExportExcel = () => {
    if (!canExportReports) return;
    exportExcel(activeTab, toExcelRows());
  };

  const handleExportPDF = () => {
    if (!canExportReports) return;
    exportPDF(
      activeTab,
      toExcelRows(),
      properties,
      propId,
      activePropertyId,
      dateFrom,
      dateTo,
      search,
      settings,
    );
  };

  const handleExportAnalyticsPDF = () => {
    if (!canExportReports) return;
    exportAnalyticsPDF(
      analytics,
      rooms,
      employees,
      evalStats,
      properties,
      propId,
      activePropertyId,
      settings,
    );
  };

  return { handleExportExcel, handleExportPDF, handleExportAnalyticsPDF };
}
