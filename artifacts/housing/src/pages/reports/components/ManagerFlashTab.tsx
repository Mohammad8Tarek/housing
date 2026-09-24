import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { printLuxuryReport } from "../utils/luxury-report-engine";
import { formatNationality } from "@/lib/countries";
import { getProfileDisplayDepartment } from "@/lib/profile-display-utils";
import {
  FileBarChart2,
  Building2,
  BedDouble,
  Users,
  Wrench,
  Sparkles,
  Printer,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Hotel,
  ShieldCheck,
  Building,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface ManagerFlashTabProps {
  ar: boolean;
  isLoading: boolean;
  properties: any[];
  activePropertyId?: number | string;
  rooms: any[];
  buildings: any[];
  floors: any[];
  assignments: any[];
  reservations: any[];
  maintenance: any[];
  profiles: any[];
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onRegisterExport?: (actions: { exportExcel?: () => void; exportPDF?: () => void }) => void;
}

export function ManagerFlashTab({
  ar,
  isLoading,
  properties = [],
  activePropertyId,
  rooms = [],
  buildings = [],
  floors = [],
  assignments = [],
  reservations = [],
  maintenance = [],
  profiles = [],
  onExportPDF,
  onExportExcel,
  onRegisterExport,
}: ManagerFlashTabProps) {
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>(
    activePropertyId ? String(activePropertyId) : "all"
  );

  // Active Property Name and details
  const currentProperty = useMemo(() => {
    if (!selectedPropertyFilter || selectedPropertyFilter === "all") {
      return properties[0] || { name: "سكن منتجعات صن رايز", code: "SUNRISE" };
    }
    return properties.find((p: any) => String(p.id) === String(selectedPropertyFilter)) || {
      name: "سكن منتجعات صن رايز",
      code: "SUNRISE",
    };
  }, [properties, selectedPropertyFilter]);

  // Operational metrics calculated for flash report
  const metrics = useMemo(() => {
    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((sum: number, r: any) => sum + (r.capacity || 1), 0);
    const occupiedBeds = rooms.reduce((sum: number, r: any) => sum + (r.currentOccupancy || 0), 0);
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Room status categories
    const vacantClean = rooms.filter((r: any) => r.status === "available").length;
    const vacantDirty = rooms.filter((r: any) => r.status === "dirty").length;
    const occupiedClean = rooms.filter((r: any) => r.status === "occupied").length;
    const occupiedDirty = rooms.filter((r: any) => r.status === "occupied_dirty").length;
    const occupiedVacation = rooms.filter((r: any) => r.status === "occupied_vacation").length;
    const outOfOrder = rooms.filter((r: any) =>
      ["out_of_order", "ooo", "maintenance"].includes(r.status?.toLowerCase())
    ).length;
    const outOfService = rooms.filter((r: any) =>
      ["out_of_service", "oos"].includes(r.status?.toLowerCase())
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
      return d === reportDate && (a.status === "CHECKED_OUT" || a.status === "LEFT");
    }).length;

    const inHouseActive = assignments.filter(
      (a: any) => a.status === "ACTIVE" || a.status === "VACATION"
    ).length;

    const vacationResidents = assignments.filter(
      (a: any) => a.status === "VACATION"
    ).length;

    const roomTransfers = assignments.filter((a: any) => {
      const d = a.updatedAt ? String(a.updatedAt).slice(0, 10) : "";
      return d === reportDate && a.status === "TRANSFERRED";
    }).length;

    const openTickets = maintenance.filter(
      (t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS"
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
    };
  }, [rooms, assignments, reservations, maintenance, reportDate]);

  // Building Capacity Breakdown
  const buildingBreakdown = useMemo(() => {
    return buildings.map((b: any) => {
      const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
      const totalRooms = bRooms.length;
      const totalBeds = bRooms.reduce((acc: number, r: any) => acc + (r.capacity || 1), 0);
      const occupiedBeds = bRooms.reduce((acc: number, r: any) => acc + (r.currentOccupancy || 0), 0);
      const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
      const dirtyCount = bRooms.filter((r: any) => r.status === "dirty" || r.status === "occupied_dirty").length;
      const oooCount = bRooms.filter((r: any) =>
        ["out_of_order", "out_of_service", "maintenance", "ooo", "oos"].includes(r.status?.toLowerCase())
      ).length;
      const occPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

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
  }, [buildings, rooms, floors]);

  // Top Departments breakdown
  const departmentBreakdown = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const dept = ar ? getProfileDisplayDepartment(p, true) : (p.department?.trim() || "Unassigned");
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
  }, [profiles, ar]);

  // Top Nationalities breakdown
  const nationalityBreakdown = useMemo(() => {
    const natCounts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const rawNat = p.nationality?.trim();
      const nat = ar ? (formatNationality(rawNat, true, false) || "غير مسجل") : (rawNat || "Other");
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
  }, [profiles, ar]);

  const nowFormatted = useMemo(() => {
    return new Date().toLocaleDateString(ar ? "ar-EG" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [ar]);

  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Building Capacity Matrix
    const matrixRows = buildingBreakdown.map((row) => ({
      [ar ? "المبنى والكود" : "Building & Code"]: `${row.name} (${row.code})`,
      [ar ? "الأدوار" : "Floors"]: row.floorsCount,
      [ar ? "إجمالي الغرف" : "Total Rooms"]: row.totalRooms,
      [ar ? "إجمالي الأسرة" : "Total Beds"]: row.totalBeds,
      [ar ? "المشغول" : "Occupied"]: row.occupiedBeds,
      [ar ? "الشاغر المتاح" : "Vacant Beds"]: row.vacantBeds,
      [ar ? "متسخ" : "Dirty"]: row.dirtyCount,
      [ar ? "صيانة (OOO)" : "OOO"]: row.oooCount,
      [ar ? "نسبة الإشغال" : "Occupancy Rate"]: `${row.occPercent}%`,
      [ar ? "الحالة" : "Status"]:
        row.occPercent >= 90
          ? (ar ? "إشغال مرتفع" : "High Occupancy")
          : row.occPercent >= 70
          ? (ar ? "إشغال متوسط" : "Moderate")
          : (ar ? "متاح للتسكين" : "Available"),
    }));
    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, ar ? "مصفوفة إشغال المباني" : "Building Matrix");

    // Sheet 2: Top Occupying Departments
    const deptRows = departmentBreakdown.map((dept, idx) => ({
      [ar ? "الترتيب" : "Rank"]: idx + 1,
      [ar ? "الإدارة / القسم" : "Department"]: dept.name,
      [ar ? "عدد الموظفين المقيمين" : "Staff Count"]: dept.count,
      [ar ? "نسبة الإشغال من السكن" : "Occupancy Share"]: `${dept.percent}%`,
    }));
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    XLSX.utils.book_append_sheet(wb, wsDept, ar ? "إشغال الأقسام" : "Departments");

    // Sheet 3: Nationalities Distribution
    const natRows = nationalityBreakdown.map((nat, idx) => ({
      [ar ? "الترتيب" : "Rank"]: idx + 1,
      [ar ? "الجنسية" : "Nationality"]: nat.name,
      [ar ? "العدد" : "Count"]: nat.count,
      [ar ? "النسبة المئوية" : "Percentage"]: `${nat.percent}%`,
    }));
    const wsNat = XLSX.utils.json_to_sheet(natRows);
    XLSX.utils.book_append_sheet(wb, wsNat, ar ? "توزيع الجنسيات" : "Nationalities");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Daily_Morning_Operations_Report_${dateStr}.xlsx`);
  };

  const handlePrint = async () => {
    // 1. Generate Building Capacity Matrix Rows
    const rows = buildingBreakdown.map((row) => ({
      [ar ? "المبنى والكود" : "Building & Code"]: `${row.name} (${row.code})`,
      [ar ? "الأدوار" : "Floors"]: row.floorsCount,
      [ar ? "إجمالي الغرف" : "Rooms"]: row.totalRooms,
      [ar ? "إجمالي الأسرة" : "Total Beds"]: row.totalBeds,
      [ar ? "المشغول" : "Occupied"]: row.occupiedBeds,
      [ar ? "الشاغر المتاح" : "Vacant Beds"]: row.vacantBeds,
      [ar ? "متسخ" : "Dirty"]: row.dirtyCount,
      [ar ? "صيانة (OOO)" : "OOO"]: row.oooCount,
      [ar ? "نسبة الإشغال" : "Occupancy Rate"]: `${row.occPercent}%`,
      [ar ? "الحالة" : "Status"]:
        row.occPercent >= 90
          ? (ar ? "إشغال مرتفع" : "High Occupancy")
          : row.occPercent >= 70
          ? (ar ? "إشغال متوسط" : "Moderate")
          : (ar ? "متاح للتسكين" : "Available"),
    }));

    // 2. Generate Demographics Breakdown HTML (Top Occupying Departments & Nationalities)
    const demographicsHtml = `
      <div class="demographics-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 16px 0; page-break-inside: avoid;">
        <!-- Top Occupying Departments -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #ffffff;">
          <div style="font-weight: 800; font-size: 8.5pt; color: #0f2a44; border-bottom: 1.5px solid #0f2a44; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>🏢 ${ar ? "أعلى الإدارات والأقسام إشغالاً بالسكن (Top Departments)" : "Top Occupying Departments"}</span>
            <span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">${profiles.length} ${ar ? "موظف مسجل" : "Registered Staff"}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
            <thead>
              <tr style="border-bottom: 1px solid #cbd5e1; color: #334155; font-weight: 700;">
                <th style="text-align: ${ar ? "right" : "left"}; padding: 4px 5px;">${ar ? "الإدارة / القسم" : "Department"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 60px;">${ar ? "العدد" : "Count"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 60px;">${ar ? "النسبة" : "Percent"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 90px;">${ar ? "التمثيل" : "Progress"}</th>
              </tr>
            </thead>
            <tbody>
              ${departmentBreakdown
                .map(
                  (dept) => `
                <tr style="border-bottom: 0.5px solid #f1f5f9;">
                  <td style="text-align: ${ar ? "right" : "left"}; padding: 4px 5px; font-weight: 600; color: #0f172a;">${dept.name}</td>
                  <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #0284c7;">${dept.count}</td>
                  <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #334155;">${dept.percent}%</td>
                  <td style="text-align: center; padding: 4px 5px;">
                    <div style="background: #e2e8f0; border-radius: 3px; height: 6px; width: 100%; overflow: hidden;">
                      <div style="background: #0284c7; height: 6px; width: ${Math.min(dept.percent, 100)}%;"></div>
                    </div>
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Nationalities Distribution -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #ffffff;">
          <div style="font-weight: 800; font-size: 8.5pt; color: #0f2a44; border-bottom: 1.5px solid #0f2a44; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>🌍 ${ar ? "توزيع الجنسيات بالسكن (Nationalities Distribution)" : "Nationalities Distribution"}</span>
            <span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">${nationalityBreakdown.length} ${ar ? "جنسيات" : "Nationalities"}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
            <thead>
              <tr style="border-bottom: 1px solid #cbd5e1; color: #334155; font-weight: 700;">
                <th style="text-align: ${ar ? "right" : "left"}; padding: 4px 5px;">${ar ? "الجنسية" : "Nationality"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 60px;">${ar ? "العدد" : "Count"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 60px;">${ar ? "النسبة" : "Percent"}</th>
                <th style="text-align: center; padding: 4px 5px; width: 90px;">${ar ? "التمثيل" : "Progress"}</th>
              </tr>
            </thead>
            <tbody>
              ${nationalityBreakdown
                .map(
                  (nat) => `
                <tr style="border-bottom: 0.5px solid #f1f5f9;">
                  <td style="text-align: ${ar ? "right" : "left"}; padding: 4px 5px; font-weight: 600; color: #0f172a;">${nat.name}</td>
                  <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #059669;">${nat.count}</td>
                  <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #334155;">${nat.percent}%</td>
                  <td style="text-align: center; padding: 4px 5px;">
                    <div style="background: #e2e8f0; border-radius: 3px; height: 6px; width: 100%; overflow: hidden;">
                      <div style="background: #059669; height: 6px; width: ${Math.min(nat.percent, 100)}%;"></div>
                    </div>
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    await printLuxuryReport({
      title: ar ? "تقرير المدير اليومي الشامل (Flash Report)" : "Executive Manager Flash Report",
      activeTab: "manager_flash",
      rows,
      properties,
      activePropertyId,
      language: ar ? "ar" : "en",
      customBottomSectionsHtml: demographicsHtml,
      kpiCards: [
        {
          label: "Total Buildings",
          labelAr: "إجمالي المباني",
          value: buildings.length,
          color: "gold",
        },
        {
          label: "Total Capacity",
          labelAr: "إجمالي الأسِرّة",
          value: metrics.totalBeds,
          color: "blue",
          subtext: `${metrics.totalRooms} ${ar ? "غرفة مسجلة" : "Rooms"}`,
        },
        {
          label: "Occupied Beds",
          labelAr: "الأسِرّة المشغولة",
          value: metrics.occupiedBeds,
          color: "blue",
          subtext: `${metrics.occupancyRate}% ${ar ? "نسبة الإشغال الكلية" : "Occupancy Rate"}`,
        },
        {
          label: "Vacant Beds",
          labelAr: "الأسِرّة الشاغرة",
          value: metrics.vacantBeds,
          color: "green",
          subtext: `${metrics.totalBeds > 0 ? Math.round((metrics.vacantBeds / metrics.totalBeds) * 100) : 0}% ${ar ? "متاح للتسكين" : "Available"}`,
        },
        {
          label: "Dirty Rooms (HK)",
          labelAr: "غرف متسخة (HK)",
          value: metrics.vacantDirty + metrics.occupiedDirty,
          color: (metrics.vacantDirty + metrics.occupiedDirty) > 0 ? "orange" : "green",
          subtext: ar ? "تحتاج لتجهيز" : "Pending HK",
        },
        {
          label: "Open Maintenance",
          labelAr: "بلاغات صيانة مفتوحة",
          value: metrics.openTickets,
          color: metrics.openTickets > 0 ? "red" : "green",
          subtext: ar ? "قيد الإصلاح" : "In Progress",
        },
      ],
    });
  };

  useEffect(() => {
    onRegisterExport?.({
      exportExcel: handleExcelExport,
      exportPDF: handlePrint,
    });
  }, [handleExcelExport, handlePrint, onRegisterExport]);

  return (
    <div id="manager-flash-report" className="space-y-6 print:space-y-4 print:p-0">
      {/* ── Top Executive Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-900/50 print:bg-white print:text-black print:border-slate-300 print:shadow-none print:p-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Hotel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {currentProperty.name}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-300 font-medium">
                  {ar ? "سكن العاملين والموظفين" : "Staff Housing Accommodation"}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
                {ar ? "التقرير الصباحي الشامل للإشغال والتشغيل" : "Daily Morning Operations & Occupancy Report"}
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300/80 flex items-center gap-1.5 pt-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {ar ? `تاريخ وساعة التوليد: ${nowFormatted}` : `Generated on: ${nowFormatted}`}
          </p>
        </div>

        {/* Date Selector, Property Switcher & Print Actions */}
        <div className="flex items-center gap-2.5 print:hidden flex-wrap">
          {/* Property Selector */}
          {properties.length > 1 && (
            <select
              value={selectedPropertyFilter}
              onChange={(e) => setSelectedPropertyFilter(e.target.value)}
              aria-label={ar ? "اختيار الفندق أو السكن" : "Select property"}
              className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">{ar ? "كافة الفنادق والسكنات" : "All Properties"}</option>
              {properties.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300">{ar ? "تاريخ التقرير:" : "Date:"}</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-white focus:outline-hidden"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportDate(new Date().toISOString().split("T")[0])}
            className="text-xs h-8 bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            {ar ? "اليوم" : "Today"}
          </Button>
        </div>
      </div>

      {/* ── KPI Row: Core Capacity & Occupancy ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Capacity */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "الطاقة الاستيعابية" : "Total Capacity"}
              </span>
              <BedDouble className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{metrics.totalBeds}</div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.totalRooms} غرفة مسجلة` : `${metrics.totalRooms} Total Rooms`}
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {ar ? "نسبة الإشغال الفعلية" : "Occupancy Rate"}
              </span>
              <Building2 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.occupancyRate}%
            </div>
            <Progress value={metrics.occupancyRate} className="h-1.5 bg-amber-200 dark:bg-amber-950" />
          </CardContent>
        </Card>

        {/* In-House Occupants */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "الأسرة المشغولة" : "Occupied Beds"}
              </span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.occupiedBeds}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `+${metrics.vacationResidents} في إجازة` : `+${metrics.vacationResidents} On Vacation`}
            </div>
          </CardContent>
        </Card>

        {/* Vacant Beds */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "الأسرة الشاغرة" : "Available Beds"}
              </span>
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {metrics.vacantBeds}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.vacantClean} غرفة جاهزة فوراً` : `${metrics.vacantClean} Ready Rooms`}
            </div>
          </CardContent>
        </Card>

        {/* Dirty Rooms */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "غرف بانتظار النظافة" : "Dirty Rooms"}
              </span>
              <Sparkles className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.vacantDirty + metrics.occupiedDirty}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.vacantDirty} شاغرة + ${metrics.occupiedDirty} مشغولة` : `${metrics.vacantDirty} Vacant, ${metrics.occupiedDirty} Occ`}
            </div>
          </CardContent>
        </Card>

        {/* Out of Order */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "غرف صيانة (معطلة)" : "Out of Order (OOO)"}
              </span>
              <Wrench className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.outOfOrder + metrics.outOfService}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.openTickets} طلب صيانة نشط` : `${metrics.openTickets} Active Tickets`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Movements & Today's Operational Flow ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Arrivals Card */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" />
                {ar ? "حركة الوصول اليومية" : "Arrivals Today"}
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs">
                {ar ? "وصول" : "Arrivals"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "المتوقع وصولهم (حجوزات):" : "Expected (Due In):"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.arrivalsExpected}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "تم تسكينهم بالفعل اليوم:" : "Checked-in Today:"}</span>
              <span className="text-sm font-semibold text-emerald-600">{metrics.arrivalsCheckedIn}</span>
            </div>
          </CardContent>
        </Card>

        {/* Departures Card */}
        <Card className="border-rose-500/20 bg-rose-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                {ar ? "المغادرات والتصفيات" : "Departures Today"}
              </CardTitle>
              <Badge variant="outline" className="border-rose-500/40 text-rose-600 text-xs">
                {ar ? "مغادرة" : "Due Out"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "المستحق مغادرتهم اليوم:" : "Due Out Today:"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.departuresExpected}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "تمت المغادرة الفعلية:" : "Checked-out Today:"}</span>
              <span className="text-sm font-semibold text-rose-600">{metrics.departuresCheckedOut}</span>
            </div>
          </CardContent>
        </Card>

        {/* In-House Stayovers */}
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {ar ? "المقيمون المستمرون" : "In-House Stayovers"}
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-xs">
                {ar ? "مستمر" : "Stayover"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "نزلاء مستمرون بالسكن:" : "Active Residents:"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.inHouseActive}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "في إجازات دورية:" : "On Vacation:"}</span>
              <span className="text-sm font-semibold text-blue-600">{metrics.vacationResidents}</span>
            </div>
          </CardContent>
        </Card>

        {/* Internal Transfers */}
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-400 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                {ar ? "التنقلات الداخلية" : "Room Transfers"}
              </CardTitle>
              <Badge variant="outline" className="border-purple-500/40 text-purple-600 text-xs">
                {ar ? "تنقلات" : "Transfers"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "نقل أسرة وغرف اليوم:" : "Room Moves Today:"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.roomTransfers}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "إجمالي المباني النشطة:" : "Active Buildings:"}</span>
              <span className="text-sm font-semibold text-purple-600">{buildings.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Building Capacity Matrix ── */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-foreground">
              {ar ? "مصفوفة الطاقة الاستيعابية وإشغال المباني" : "Building Capacity & Occupancy Matrix"}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {ar ? `إجمالي المباني: ${buildings.length} مبنى` : `Total Buildings: ${buildings.length}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44] text-white">
                <TableHead className="text-white">{ar ? "المبنى والكود" : "Building & Code"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الأدوار" : "Floors"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "إجمالي الغرف" : "Rooms"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "إجمالي الأسرة" : "Total Beds"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "المشغول" : "Occupied"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الشاغر المتاح" : "Vacant Beds"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "متسخ" : "Dirty"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "صيانة (OOO)" : "OOO"}</TableHead>
                <TableHead className="text-white text-center min-w-[150px]">{ar ? "نسبة الإشغال" : "Occupancy Rate"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildingBreakdown.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div>
                      <p className="font-bold text-sm text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{row.code}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{row.floorsCount}</TableCell>
                  <TableCell className="text-center font-semibold text-xs">{row.totalRooms}</TableCell>
                  <TableCell className="text-center font-bold text-xs">{row.totalBeds}</TableCell>
                  <TableCell className="text-center font-semibold text-xs text-emerald-600">{row.occupiedBeds}</TableCell>
                  <TableCell className="text-center font-semibold text-xs text-sky-600">{row.vacantBeds}</TableCell>
                  <TableCell className="text-center text-xs">
                    {row.dirtyCount > 0 ? (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
                        {row.dirtyCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {row.oooCount > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        {row.oooCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <span className="font-mono font-bold text-xs w-9 text-right">{row.occPercent}%</span>
                      <Progress
                        value={row.occPercent}
                        className="w-20 h-2"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        row.occPercent >= 90
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : row.occPercent >= 70
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }
                    >
                      {row.occPercent >= 90
                        ? (ar ? "إشغال مرتفع" : "High Occ.")
                        : row.occPercent >= 70
                        ? (ar ? "إشغال متوسط" : "Moderate")
                        : (ar ? "متاح" : "Available")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Demographics Breakdown (Departments & Nationalities) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Department Breakdown */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-primary" />
                {ar ? "أعلى الإدارات إشغالاً بالسكن" : "Top Occupying Departments"}
              </span>
              <Badge variant="secondary" className="text-xs">
                {profiles.length} {ar ? "موظف" : "Staff"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5">
            {departmentBreakdown.map((dept) => (
              <div key={dept.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{dept.name}</span>
                  <span className="font-mono text-muted-foreground">{dept.count} ({dept.percent}%)</span>
                </div>
                <Progress value={dept.percent} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Nationality Breakdown */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                {ar ? "توزيع الجنسيات بالسكن" : "Nationalities Distribution"}
              </span>
              <Badge variant="secondary" className="text-xs">
                {nationalityBreakdown.length} {ar ? "جنسيات" : "Nationalities"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5">
            {nationalityBreakdown.map((nat) => (
              <div key={nat.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{nat.name}</span>
                  <span className="font-mono text-muted-foreground">{nat.count} ({nat.percent}%)</span>
                </div>
                <Progress value={nat.percent} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Official Signatures Box ── */}
      <div className="border rounded-2xl p-5 bg-card shadow-xs space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
          {ar ? "اعتماد ومراجعة التقرير اليومي" : "Daily Report Formal Approvals"}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Prepared By */}
          <div className="border border-dashed rounded-xl p-4 text-center space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {ar ? "إعداد مشرف السكن المناوب" : "Prepared By: Duty Housing Supervisor"}
            </p>
            <div className="h-10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50 font-mono">________________________</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "التوقيع والوقت" : "Signature & Timestamp"}
            </p>
          </div>

          {/* Housekeeping Manager */}
          <div className="border border-dashed rounded-xl p-4 text-center space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {ar ? "مراجعة مدير الإشراف الداخلي" : "Reviewed By: Executive Housekeeper"}
            </p>
            <div className="h-10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50 font-mono">________________________</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "التوقيع والاعتماد" : "Signature & Approval"}
            </p>
          </div>

          {/* HR Director */}
          <div className="border border-dashed rounded-xl p-4 text-center space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {ar ? "اعتماد مدير الموارد البشرية / المدير العام" : "Approved By: HR Director / GM"}
            </p>
            <div className="h-10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50 font-mono">________________________</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "الختم والتوقيع الرسمي" : "Official Seal & Sign-off"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
