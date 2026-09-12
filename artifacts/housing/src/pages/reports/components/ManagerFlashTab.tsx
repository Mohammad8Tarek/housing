import { useState, useMemo } from "react";
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
  Flame,
  Hotel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
}

export function ManagerFlashTab({
  ar,
  isLoading,
  properties,
  activePropertyId,
  rooms,
  buildings,
  floors,
  assignments,
  reservations,
  maintenance,
  profiles,
  onExportPDF,
  onExportExcel,
}: ManagerFlashTabProps) {
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Current Property info
  const currentProperty = useMemo(() => {
    if (!activePropertyId || activePropertyId === "all") {
      return properties[0] || { name: "Sunrise Resort Housing", code: "SRH" };
    }
    return properties.find((p: any) => String(p.id) === String(activePropertyId)) || {
      name: "Sunrise Resort Housing",
      code: "SRH",
    };
  }, [properties, activePropertyId]);

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
      const d = res.checkInDate ? res.checkInDate.slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const arrivalsCheckedIn = assignments.filter((a: any) => {
      const d = a.checkInDate ? a.checkInDate.slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const departuresExpected = assignments.filter((a: any) => {
      if (a.status !== "ACTIVE") return false;
      const d = a.checkOutDate ? a.checkOutDate.slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const departuresCheckedOut = assignments.filter((a: any) => {
      if (a.status !== "CHECKED_OUT") return false;
      const d = a.checkOutDate ? a.checkOutDate.slice(0, 10) : "";
      return d === reportDate;
    }).length;

    const activeResidents = assignments.filter((a: any) => a.status === "ACTIVE").length;
    const vacationResidents = profiles.filter((p: any) => p.status === "VACATION").length;

    // Maintenance stats
    const openTickets = maintenance.filter((m: any) =>
      ["open", "pending", "in_progress"].includes(m.status?.toLowerCase())
    ).length;
    const urgentTickets = maintenance.filter(
      (m: any) =>
        ["open", "pending", "in_progress"].includes(m.status?.toLowerCase()) &&
        m.priority?.toLowerCase() === "urgent"
    ).length;

    // Building breakdown
    const buildingRows = buildings.map((b: any) => {
      const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
      const bTotalRooms = bRooms.length;
      const bTotalBeds = bRooms.reduce((sum: number, r: any) => sum + (r.capacity || 1), 0);
      const bOccupied = bRooms.reduce((sum: number, r: any) => sum + (r.currentOccupancy || 0), 0);
      const bVacant = Math.max(0, bTotalBeds - bOccupied);
      const bDirty = bRooms.filter((r: any) => r.status === "dirty" || r.status === "occupied_dirty").length;
      const bOOO = bRooms.filter((r: any) =>
        ["out_of_order", "out_of_service", "maintenance", "ooo", "oos"].includes(
          r.status?.toLowerCase()
        )
      ).length;
      const bOccRate = bTotalBeds > 0 ? Math.round((bOccupied / bTotalBeds) * 100) : 0;

      return {
        id: b.id,
        name: b.name || `#${b.id}`,
        code: b.code || "â€”",
        rooms: bTotalRooms,
        totalBeds: bTotalBeds,
        occupiedBeds: bOccupied,
        vacantBeds: bVacant,
        dirtyRooms: bDirty,
        oooRooms: bOOO,
        occupancyRate: bOccRate,
      };
    });

    // Department breakdown
    const deptCountMap: Record<string, number> = {};
    profiles.forEach((p: any) => {
      if (p.status === "ACTIVE" || p.status === "VACATION") {
        const d = p.department || (ar ? "Ø¹Ø§Ù…" : "General");
        deptCountMap[d] = (deptCountMap[d] || 0) + 1;
      }
    });
    const topDepartments = Object.entries(deptCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Nationality breakdown
    const natCountMap: Record<string, number> = {};
    profiles.forEach((p: any) => {
      if (p.status === "ACTIVE") {
        const n = p.nationality || (ar ? "ØºÙŠØ± Ù…Ø­Ø¯Ø¯" : "Unspecified");
        natCountMap[n] = (natCountMap[n] || 0) + 1;
      }
    });
    const topNationalities = Object.entries(natCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

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
      activeResidents,
      vacationResidents,
      openTickets,
      urgentTickets,
      buildingRows,
      topDepartments,
      topNationalities,
    };
  }, [rooms, buildings, assignments, reservations, maintenance, profiles, reportDate, ar]);

  const nowFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(ar ? "ar-EG" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [ar]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="manager-flash-report" className="space-y-6 print:space-y-4 print:p-0">
      {/* â”€â”€ Top Bar / Header â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-card to-card border border-amber-500/20 p-5 rounded-2xl shadow-xs print:border-none print:shadow-none print:p-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs px-2.5 py-0.5 shadow-xs">
              <Flame className="w-3.5 h-3.5 mr-1" />
              OPERA PMS FLASH
            </Badge>
            <span className="text-xs text-muted-foreground">â€¢</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {currentProperty.name}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {ar ? "ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø¯ÙŠØ± Ø§Ù„ØµØ¨Ø§Ø­ÙŠ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ (Manager Flash)" : "Executive Manager Flash Report"}
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {ar ? `ØªÙ… Ø§Ù„ØªÙˆÙ„ÙŠØ¯ ÙÙŠ: ${nowFormatted}` : `Generated on: ${nowFormatted}`}
          </p>
        </div>

        {/* Date Selector & Print Actions */}
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{ar ? "ØªØ§Ø±ÙŠØ® Ø§Ù„ØªÙ‚Ø±ÙŠØ±:" : "Date:"}</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium focus:outline-hidden"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportDate(new Date().toISOString().split("T")[0])}
            className="text-xs h-8"
          >
            {ar ? "Ø§Ù„ÙŠÙˆÙ…" : "Today"}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? "Ø·Ø¨Ø§Ø¹Ø© Ø§Ù„ØªÙ‚Ø±ÙŠØ±" : "Print Flash"}
          </Button>

          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              className="h-8 text-xs gap-1.5"
            >
              <FileBarChart2 className="w-3.5 h-3.5 text-red-500" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* â”€â”€ KPI Row: Core Capacity & Occupancy â”€â”€ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Capacity */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "Ø§Ù„Ø·Ø§Ù‚Ø© Ø§Ù„Ø§Ø³ØªÙŠØ¹Ø§Ø¨ÙŠØ©" : "Total Capacity"}
              </span>
              <BedDouble className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{metrics.totalBeds}</div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.totalRooms} ØºØ±ÙØ© Ù…Ø³Ø¬Ù„Ø©` : `${metrics.totalRooms} Total Rooms`}
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {ar ? "Ù†Ø³Ø¨Ø© Ø§Ù„Ø¥Ø´ØºØ§Ù„" : "Occupancy Rate"}
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
                {ar ? "Ø§Ù„Ù…Ù‚ÙŠÙ…ÙˆÙ† Ø­Ø§Ù„ÙŠØ§Ù‹" : "In-House Beds"}
              </span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.occupiedBeds}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `+${metrics.vacationResidents} ÙÙŠ Ø¥Ø¬Ø§Ø²Ø©` : `+${metrics.vacationResidents} On Vacation`}
            </div>
          </CardContent>
        </Card>

        {/* Vacant Beds */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "Ø§Ù„Ø£Ø³Ø±Ø© Ø§Ù„Ø´Ø§ØºØ±Ø©" : "Available Beds"}
              </span>
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {metrics.vacantBeds}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.vacantClean} ØºØ±ÙØ© Ø¬Ø§Ù‡Ø²Ø© ÙÙˆØ±Ø§Ù‹` : `${metrics.vacantClean} Ready Rooms`}
            </div>
          </CardContent>
        </Card>

        {/* Dirty Rooms */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "ØºØ±Ù Ø¨Ø­Ø§Ø¬Ø© Ù†Ø¸Ø§ÙØ©" : "Dirty Rooms"}
              </span>
              <Sparkles className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.vacantDirty + metrics.occupiedDirty}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.vacantDirty} Ø´Ø§ØºØ±Ø© + ${metrics.occupiedDirty} Ù…Ø´ØºÙˆÙ„Ø©` : `${metrics.vacantDirty} Vacant, ${metrics.occupiedDirty} Occ`}
            </div>
          </CardContent>
        </Card>

        {/* Out of Order */}
        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "ØºØ±Ù Ø§Ù„ØµÙŠØ§Ù†Ø© (OOO)" : "Out of Order"}
              </span>
              <Wrench className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.outOfOrder + metrics.outOfService}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ar ? `${metrics.openTickets} ØªØ°ÙƒØ±Ø© ØµÙŠØ§Ù†Ø© Ø¬Ø§Ø±ÙŠØ©` : `${metrics.openTickets} Active Tickets`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Movements & Today's Operational Flow â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Arrivals Card */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" />
                {ar ? "Ø­Ø±ÙƒØ© Ø§Ù„ÙˆØµÙˆÙ„ (Arrivals)" : "Arrivals Today"}
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs">
                {ar ? "ÙˆØµÙˆÙ„" : "Arrivals"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "Ø§Ù„Ù…ØªÙˆÙ‚Ø¹ ÙˆØµÙˆÙ„Ù‡Ù…:" : "Expected (Due In):"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.arrivalsExpected}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "ØªÙ… Ø§Ù„ØªØ³ÙƒÙŠÙ† Ø§Ù„ÙŠÙˆÙ…:" : "Checked-in Today:"}</span>
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
                {ar ? "Ø§Ù„Ù…ØºØ§Ø¯Ø±Ø§Øª (Due Out)" : "Departures (Due Out)"}
              </CardTitle>
              <Badge variant="outline" className="border-rose-500/40 text-rose-600 text-xs">
                {ar ? "Ù…ØºØ§Ø¯Ø±Ø©" : "Due Out"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "Ø§Ù„Ù…Ø³ØªØ­Ù‚ Ù…ØºØ§Ø¯Ø±ØªÙ‡Ù…:" : "Due Out Today:"}</span>
              <span className="text-lg font-bold text-foreground">{metrics.departuresExpected}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "ØªÙ… Ø¥Ø®Ù„Ø§Ø¤Ù‡Ù… Ø§Ù„ÙŠÙˆÙ…:" : "Checked-out Today:"}</span>
              <span className="text-sm font-semibold text-rose-600">{metrics.departuresCheckedOut}</span>
            </div>
          </CardContent>
        </Card>

        {/* Housekeeping Priority */}
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {ar ? "Ø®Ø·Ø© Ø§Ù„Ù†Ø¸Ø§ÙØ© (Housekeeping)" : "Housekeeping Queue"}
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-xs">
                {ar ? "Ù†Ø¸Ø§ÙØ©" : "Clean Status"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "Ø´Ø§ØºØ±Ø© Ù…ØªØ³Ø®Ø© (Ø£ÙˆÙ„ÙˆÙŠØ© 1):" : "Vacant Dirty (P1):"}</span>
              <span className="text-sm font-bold text-rose-600">{metrics.vacantDirty}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "Ù…Ø´ØºÙˆÙ„Ø© Ù…ØªØ³Ø®Ø© (Ø£ÙˆÙ„ÙˆÙŠØ© 2):" : "Occupied Dirty (P2):"}</span>
              <span className="text-sm font-semibold text-amber-600">{metrics.occupiedDirty}</span>
            </div>
          </CardContent>
        </Card>

        {/* Engineering & Maintenance */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                {ar ? "Ø§Ù„ØµÙŠØ§Ù†Ø© ÙˆØ®Ø§Ø±Ø¬ Ø§Ù„Ø®Ø¯Ù…Ø©" : "Maintenance & OOO"}
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-xs">
                {ar ? "Ø£Ø¹Ø·Ø§Ù„" : "Work Orders"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "ØªØ°Ø§ÙƒØ± Ø¹Ø§Ø¬Ù„Ø© Ø·Ø§Ø±Ø¦Ø©:" : "Urgent Tickets:"}</span>
              <span className="text-sm font-bold text-red-600">{metrics.urgentTickets}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">{ar ? "ØºØ±Ù Ø®Ø§Ø±Ø¬ Ø§Ù„Ø®Ø¯Ù…Ø©:" : "Total OOO Rooms:"}</span>
              <span className="text-sm font-semibold text-amber-600">{metrics.outOfOrder + metrics.outOfService}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Building Capacity Matrix (Opera PMS Standard Table) â”€â”€ */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {ar ? "Ù…ØµÙÙˆÙØ© Ø¥Ø´ØºØ§Ù„ ÙˆØ·Ø§Ù‚Ø© Ø§Ù„Ù…Ø¨Ø§Ù†ÙŠ (Building Capacity Matrix)" : "Building Capacity & Occupancy Matrix"}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar
                  ? "ØªÙˆØ²ÙŠØ¹ Ø§Ù„ØºØ±Ù ÙˆØ§Ù„Ø£Ø³Ø±Ø© Ø§Ù„ÙØ¹Ù„ÙŠ Ù„ÙƒÙ„ Ù…Ø¨Ù†Ù‰ Ù…Ø¹ Ù…Ø¹Ø¯Ù„Ø§Øª Ø§Ù„Ø¥Ø´ØºØ§Ù„ ÙˆØ§Ù„ØºØ±Ù Ø§Ù„Ù…ØªØ³Ø®Ø©"
                  : "Physical room & bed distribution per building with occupancy rates"}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {metrics.buildingRows.length} {ar ? "Ù…Ø¨Ù†Ù‰" : "Buildings"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-muted/40 text-xs">
              <TableRow>
                <TableHead className="w-[180px]">{ar ? "Ø§Ù„Ù…Ø¨Ù†Ù‰" : "Building"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ØºØ±Ù" : "Rooms"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø£Ø³Ø±Ø©" : "Total Beds"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "Ø§Ù„Ù…Ø´ØºÙˆÙ„" : "Occupied"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "Ø§Ù„Ø´Ø§ØºØ±" : "Vacant"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "Ù…ØªØ³Ø®" : "Dirty"}</TableHead>
                <TableHead className="text-center w-[100px]">{ar ? "ØµÙŠØ§Ù†Ø© OOO" : "OOO"}</TableHead>
                <TableHead className="w-[180px]">{ar ? "Ù†Ø³Ø¨Ø© Ø§Ù„Ø¥Ø´ØºØ§Ù„" : "Occupancy %"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {metrics.buildingRows.map((b: any) => (
                <TableRow key={b.id} className="hover:bg-muted/30">
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{b.name}</span>
                      {b.code !== "â€”" && (
                        <span className="text-[10px] text-muted-foreground">({b.code})</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono">{b.rooms}</TableCell>
                  <TableCell className="text-center font-mono font-semibold">{b.totalBeds}</TableCell>
                  <TableCell className="text-center font-mono text-emerald-600 font-semibold">
                    {b.occupiedBeds}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sky-600 font-semibold">
                    {b.vacantBeds}
                  </TableCell>
                  <TableCell className="text-center font-mono text-rose-600">
                    {b.dirtyRooms > 0 ? (
                      <Badge variant="outline" className="text-rose-600 border-rose-200 px-1.5 py-0">
                        {b.dirtyRooms}
                      </Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-amber-600">
                    {b.oooRooms > 0 ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 px-1.5 py-0">
                        {b.oooRooms}
                      </Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={b.occupancyRate}
                        className={`h-2 flex-1 ${
                          b.occupancyRate >= 95
                            ? "bg-rose-200 [&>div]:bg-rose-600"
                            : b.occupancyRate >= 80
                            ? "bg-amber-200 [&>div]:bg-amber-500"
                            : "bg-emerald-200 [&>div]:bg-emerald-500"
                        }`}
                      />
                      <span className="font-mono font-semibold text-xs w-10 text-right">
                        {b.occupancyRate}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {/* Total Row */}
              <TableRow className="bg-muted/60 font-bold text-xs border-t-2">
                <TableCell>{ar ? "Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙƒÙ„ÙŠ Ù„Ù„Ø³ÙƒÙ†" : "Grand Total"}</TableCell>
                <TableCell className="text-center font-mono">{metrics.totalRooms}</TableCell>
                <TableCell className="text-center font-mono">{metrics.totalBeds}</TableCell>
                <TableCell className="text-center font-mono text-emerald-700">{metrics.occupiedBeds}</TableCell>
                <TableCell className="text-center font-mono text-sky-700">{metrics.vacantBeds}</TableCell>
                <TableCell className="text-center font-mono text-rose-700">
                  {metrics.vacantDirty + metrics.occupiedDirty}
                </TableCell>
                <TableCell className="text-center font-mono text-amber-700">
                  {metrics.outOfOrder + metrics.outOfService}
                </TableCell>
                <TableCell>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {metrics.occupancyRate}%
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* â”€â”€ Bottom Strip: Departments & Nationalities Distribution â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Departments */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-500" />
              {ar ? "Ø£Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø¥Ø´ØºØ§Ù„Ø§Ù‹ ÙÙŠ Ø§Ù„Ø³ÙƒÙ†" : "Top Occupying Departments"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {metrics.topDepartments.map(([dept, count], idx) => {
              const pct = metrics.occupiedBeds > 0 ? Math.round((count / metrics.occupiedBeds) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">{dept}</span>
                    <span className="text-muted-foreground font-mono">
                      {count} {ar ? "Ù…ÙˆØ¸Ù" : "Staff"} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Nationalities */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Hotel className="w-4 h-4 text-indigo-500" />
              {ar ? "ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø¬Ù†Ø³ÙŠØ§Øª Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©" : "Nationality Demographics"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {metrics.topNationalities.map(([nat, count], idx) => {
              const pct = metrics.occupiedBeds > 0 ? Math.round((count / metrics.occupiedBeds) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">{nat}</span>
                    <span className="text-muted-foreground font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5 bg-indigo-100 dark:bg-indigo-950 [&>div]:bg-indigo-500" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* â”€â”€ Official Signatures Box (Standard Opera Hospitality) â”€â”€ */}
      <div className="border border-border/60 bg-muted/20 p-4 rounded-xl print:block text-xs">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-6">
            <div className="font-semibold text-muted-foreground">
              {ar ? "Ø¥Ø¹Ø¯Ø§Ø¯ Ù…Ø´Ø±Ù Ø§Ù„Ø³ÙƒÙ† Ø§Ù„Ù…Ù†Ø§ÙˆØ¨" : "Prepared by Housing Supervisor"}
            </div>
            <div className="border-b border-muted-foreground/30 w-32 mx-auto" />
            <div className="text-[11px] text-muted-foreground">
              {ar ? "Ø§Ù„ØªÙˆÙ‚ÙŠØ¹ ÙˆØ§Ù„ØªØ§Ø±ÙŠØ®" : "Signature & Date"}
            </div>
          </div>

          <div className="space-y-6">
            <div className="font-semibold text-muted-foreground">
              {ar ? "Ø§Ø¹ØªÙ…Ø§Ø¯ Ù…Ø¯ÙŠØ± Ø§Ù„Ø³ÙƒÙ† ÙˆØ§Ù„Ø¥Ø´Ø±Ø§Ù" : "Housing Manager Verification"}
            </div>
            <div className="border-b border-muted-foreground/30 w-32 mx-auto" />
            <div className="text-[11px] text-muted-foreground">
              {ar ? "Ø§Ù„ØªÙˆÙ‚ÙŠØ¹ ÙˆØ§Ù„ØªØ§Ø±ÙŠØ®" : "Signature & Date"}
            </div>
          </div>

          <div className="space-y-6">
            <div className="font-semibold text-muted-foreground">
              {ar ? "Ø§Ø¹ØªÙ…Ø§Ø¯ Ù…Ø¯ÙŠØ± Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ© / Ø§Ù„Ù…Ø¯ÙŠØ± Ø§Ù„Ø¹Ø§Ù…" : "HR & General Manager Sign-off"}
            </div>
            <div className="border-b border-muted-foreground/30 w-32 mx-auto" />
            <div className="text-[11px] text-muted-foreground">
              {ar ? "Ø§Ù„ØªÙˆÙ‚ÙŠØ¹ ÙˆØ§Ù„ØªØ§Ø±ÙŠØ®" : "Signature & Date"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
