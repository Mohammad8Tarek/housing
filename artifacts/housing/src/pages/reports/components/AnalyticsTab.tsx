import { Building2, BedDouble, Users, Wrench, Home } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnalyticsTabProps {
  ar: boolean;
  isLoading: boolean;
  rooms: any[];
  analytics: any;
  evalStats: any;
}

export function AnalyticsTab({
  ar,
  isLoading,
  rooms,
  analytics,
  evalStats,
}: AnalyticsTabProps) {
  return (
    <div
      id="analytics-report-content"
      className="space-y-5 bg-background p-4 print:p-0"
    >
      {/* KPI Row 1 — Rooms & Beds */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: ar ? "إجمالي الغرف" : "Total Rooms",
            value: rooms.length,
            color: "text-foreground",
            icon: <Home className="w-4 h-4" />,
          },
          {
            label: ar ? "غرف فاضية" : "Available Rooms",
            value: analytics.availableRooms,
            color: "text-green-600",
            icon: <Home className="w-4 h-4" />,
          },
          {
            label: ar ? "غرف مشغولة" : "Occupied Rooms",
            value: analytics.occupiedRooms,
            color: "text-blue-600",
            icon: <Home className="w-4 h-4" />,
          },
          {
            label: ar ? "صيانة" : "Maintenance",
            value: analytics.maintRooms,
            color: "text-orange-600",
            icon: <Wrench className="w-4 h-4" />,
          },
          {
            label: ar ? "إجمالي السراير" : "Total Beds",
            value: analytics.totalCapacity,
            color: "text-foreground",
            icon: <BedDouble className="w-4 h-4" />,
          },
          {
            label: ar ? "سراير فاضية" : "Available Beds",
            value: analytics.availableBeds,
            color: "text-green-600",
            icon: <BedDouble className="w-4 h-4" />,
          },
          {
            label: ar ? "سراير مشغولة" : "Occupied Beds",
            value: analytics.totalOccupied,
            color: "text-blue-600",
            icon: <BedDouble className="w-4 h-4" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border rounded-xl p-3 text-center shadow-sm"
          >
            <p className={`text-2xl font-bold ${s.color}`}>
              {isLoading ? "—" : s.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Occupancy Rate */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg">
              {ar ? "نسبة الإشغال الكلية" : "Overall Occupancy Rate"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {ar
                ? `${analytics.totalOccupied} من أصل ${analytics.totalCapacity} سرير مشغول`
                : `${analytics.totalOccupied} of ${analytics.totalCapacity} beds occupied`}
            </p>
          </div>
          <span
            className={`text-3xl font-black ${analytics.occRate >= 90 ? "text-red-600" : analytics.occRate >= 70 ? "text-orange-500" : "text-green-600"}`}
          >
            {analytics.occRate}%
          </span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${analytics.occRate >= 90 ? "bg-red-500" : analytics.occRate >= 70 ? "bg-orange-400" : "bg-green-500"}`}
            style={{ width: `${analytics.occRate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By Building */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {ar ? "الإشغال بالمبنى" : "Occupancy by Building"}
          </h3>
          {analytics.byBuilding.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {ar ? "لا بيانات" : "No data"}
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.byBuilding.map((b: any) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate max-w-[180px]">
                      {b.name}
                    </span>
                    <span className="text-muted-foreground text-xs ml-2 flex-shrink-0">
                      {b.currentOccupancy}/{b.capacity} {ar ? "سرير" : "beds"} ·{" "}
                      {b.availableRooms} {ar ? "غرفة فاضية" : "avail rooms"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${b.rate >= 90 ? "bg-red-500" : b.rate >= 70 ? "bg-orange-400" : "bg-green-500"}`}
                        style={{ width: `${b.rate}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-bold w-9 text-right flex-shrink-0 ${b.rate >= 90 ? "text-red-600" : b.rate >= 70 ? "text-orange-500" : "text-green-600"}`}
                    >
                      {b.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Room Type */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary" />
            {ar ? "الإشغال بنوع الغرفة" : "Occupancy by Room Type"}
          </h3>
          {analytics.byType.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {ar ? "لا بيانات" : "No data"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">
                    {ar ? "النوع" : "Type"}
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    {ar ? "غرف" : "Rooms"}
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    {ar ? "سراير" : "Beds"}
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    {ar ? "مشغول" : "Occ."}
                  </TableHead>
                  <TableHead className="text-xs text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.byType.map((t: any) => (
                  <TableRow key={t.type}>
                    <TableCell className="font-medium capitalize text-sm">
                      {t.type}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t.rooms}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t.capacity}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t.occupied}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.rate >= 90 ? "bg-red-100 text-red-700" : t.rate >= 70 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}
                      >
                        {t.rate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* By Department */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {ar ? "السكان حسب القسم" : "Residents by Department"}
          </h3>
          {analytics.byDept.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {ar ? "لا بيانات" : "No data"}
            </p>
          ) : (
            <div className="space-y-2.5">
              {analytics.byDept.map((d: any) => {
                const maxCount = analytics.byDept[0]?.count ?? 1;
                const pct = Math.round((d.count / maxCount) * 100);
                return (
                  <div key={d.dept}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{d.dept}</span>
                      <span className="text-muted-foreground text-xs ml-2 flex-shrink-0">
                        {d.count} {ar ? "موظف" : "residents"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gender Policy & Maintenance */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-bold mb-3">
              {ar ? "سياسة النوع" : "Gender Policy Distribution"}
            </h3>
            <div className="flex flex-wrap gap-3">
              {analytics.byGender.map((g: any) => (
                <div
                  key={g.gender}
                  className="flex-1 min-w-[80px] bg-muted/50 rounded-lg p-3 text-center"
                >
                  <p className="text-xl font-bold text-primary">{g.count}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {g.gender === "male"
                      ? ar
                        ? "ذكور"
                        : "Male"
                      : g.gender === "female"
                        ? ar
                          ? "إناث"
                          : "Female"
                        : ar
                          ? "مختلط"
                          : "Mixed"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" />
              {ar ? "التذاكر النشطة" : "Active Tickets"}
            </h3>
            <div className="flex gap-3 mb-3">
              <div className="flex-1 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {analytics.openMaint}
                </p>
                <p className="text-xs text-red-600/70 mt-0.5">
                  {ar ? "مفتوح" : "Open"}
                </p>
              </div>
              <div className="flex-1 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {analytics.inProg}
                </p>
                <p className="text-xs text-yellow-600/70 mt-0.5">
                  {ar ? "قيد التنفيذ" : "In Progress"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  cat: "maintenance",
                  label: ar ? "صيانة" : "Maintenance",
                  count: analytics.ticketsByCategory.maintenance,
                  color: "text-amber-600",
                  bg: "bg-amber-50 dark:bg-amber-950/30",
                },
                {
                  cat: "housekeeping",
                  label: ar ? "هاوس كيبنج" : "Housekeeping",
                  count: analytics.ticketsByCategory.housekeeping,
                  color: "text-sky-600",
                  bg: "bg-sky-50 dark:bg-sky-950/30",
                },
                {
                  cat: "general",
                  label: ar ? "عام" : "General",
                  count: analytics.ticketsByCategory.general,
                  color: "text-gray-600",
                  bg: "bg-gray-50 dark:bg-gray-950/30",
                },
              ].map((item) => (
                <div
                  key={item.cat}
                  className={`${item.bg} border rounded-lg p-2 text-center`}
                >
                  <p className={`text-lg font-bold ${item.color}`}>
                    {item.count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {analytics.topEmployees.length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-xs">
                <Users className="w-4 h-4 text-primary" />
                {ar ? "أداء الفنيين" : "Technician Performance"}
              </h3>
              <div className="space-y-2">
                {analytics.topEmployees.map((e: any) => (
                  <div
                    key={e.empId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium truncate">{e.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.total} {ar ? "تذكرة" : "tickets"} · {e.resolved}{" "}
                      {ar ? "مغلقة" : "resolved"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              {ar ? "تقييمات السكان" : "Resident Evaluations"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {evalStats.average}
                </p>
                <p className="text-xs text-green-600/70 mt-0.5">
                  {ar ? "متوسط التقييم" : "Avg Rating"}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {evalStats.total}
                </p>
                <p className="text-xs text-blue-600/70 mt-0.5">
                  {ar ? "إجمالي التقييمات" : "Total"}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {evalStats.positive}
                </p>
                <p className="text-xs text-emerald-600/70 mt-0.5">
                  {ar ? "إيجابي (4+)" : "Positive (4+)"}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {evalStats.negative}
                </p>
                <p className="text-xs text-red-600/70 mt-0.5">
                  {ar ? "سلبي (2-)" : "Negative (2-)"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
