import React from "react";
import {
  Home,
  BedDouble,
  Users,
  Wrench,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  Minus,
} from "lucide-react";

interface StatsCardsProps {
  stats: {
    totalRooms: number;
    vacantRooms: number;
    occupiedRooms: number;
    maint: number;
    totalCapacity: number;
    vacantBeds: number;
    totalOccupied: number;
    profiles: number;
    activeAss: number;
    expiringContracts: number;
    upcomingRes: number;
  };
  isLoading: boolean;
  ar?: boolean;
  activeTab?: string;
  equipmentInventory?: any[];
  rooms?: any[];
  assignments?: any[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const width = 48;
  const height = 18;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data, minVal + 1);
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible opacity-70">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function StatsCards({
  stats,
  isLoading,
  ar,
  activeTab,
  equipmentInventory = [],
  rooms = [],
  assignments = [],
}: StatsCardsProps) {
  // PMS: Housekeeping Task Assignment Sheet KPIs
  if (activeTab === "housekeeping_sheet") {
    const totalRooms = rooms.length;
    const dirtyRooms = rooms.filter((r: any) => r.status === "dirty" || r.status === "occupied_dirty").length;
    const cleanRooms = rooms.filter((r: any) => r.status === "clean" || r.status === "available").length;
    
    const todayStr = new Date().toISOString().split("T")[0];
    const turnoverRooms = rooms.filter((r: any) => {
      const isVacantDirty = r.status === "dirty" && !assignments.some((a: any) => a.roomId === r.id && a.status === "ACTIVE");
      const hasDueOut = assignments.some((a: any) => a.roomId === r.id && a.status === "ACTIVE" && a.checkOutDate && a.checkOutDate <= todayStr);
      return isVacantDirty || hasDueOut;
    }).length;

    const stayovers = rooms.filter((r: any) => {
      return assignments.some((a: any) => a.roomId === r.id && a.status === "ACTIVE");
    }).length;

    const totalEstHours = Math.round(((turnoverRooms * 35 + stayovers * 20 + cleanRooms * 10) / 60) * 10) / 10;

    const hkCards = [
      {
        label: ar ? "إجمالي غرف المهام" : "Total Assigned Rooms",
        value: totalRooms,
        sub: ar ? "لكافة أدوار ومباني السكن" : "Across all buildings",
        color: "text-foreground",
        bg: "bg-card/75 border-border/50",
        icon: Home,
        iconBg: "bg-primary/10 text-primary",
        sparkline: [20, 25, 30, 35, 40, totalRooms || 45],
        sparkColor: "#6366f1",
      },
      {
        label: ar ? "تجهيز مغادرات (Turnover)" : "Departure Turnovers",
        value: turnoverRooms,
        sub: ar ? "أولوية قصوى قبل التسكين" : "Priority 1 - Full service",
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-500/5 border-rose-500/20",
        icon: AlertTriangle,
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        sparkline: [5, 8, 6, 9, 7, turnoverRooms || 6],
        sparkColor: "#ef4444",
      },
      {
        label: ar ? "نظافة مقيمين (Stayovers)" : "Stayover Daily Service",
        value: stayovers,
        sub: ar ? "غرف مشغولة تحتاج ترتيب" : "Active occupants",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/5 border-blue-500/20",
        icon: Users,
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        sparkline: [15, 18, 20, 22, 25, stayovers || 30],
        sparkColor: "#3b82f6",
      },
      {
        label: ar ? "غرف متسخة حالياً" : "Dirty Rooms (Pending)",
        value: dirtyRooms,
        sub: ar ? "تحتاج بدء التنظيف" : "Awaiting housekeeping",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/5 border-amber-500/20",
        icon: Clock,
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        sparkline: [10, 12, 11, 14, 12, dirtyRooms || 8],
        sparkColor: "#f59e0b",
      },
      {
        label: ar ? "غرف جاهزة ونظيفة" : "Clean & Inspected",
        value: cleanRooms,
        sub: ar ? "جاهزة للتسكين الفوري" : "Ready for occupancy",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/5 border-emerald-500/20",
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        sparkline: [20, 24, 28, 30, 32, cleanRooms || 35],
        sparkColor: "#10b981",
      },
      {
        label: ar ? "إجمالي ساعات العمل التقديرية" : "Est. Cleaning Time",
        value: `${totalEstHours}h`,
        sub: ar ? "بمعدل المعايير الفندقية" : "Standard hotel workload",
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-500/5 border-sky-500/20",
        icon: TrendingUp,
        iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        sparkline: [4, 5, 6, 7, 8, Math.round(totalEstHours) || 10],
        sparkColor: "#0ea5e9",
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {hkCards.map((s) => (
          <div
            key={s.label}
            className={`border rounded-2xl p-3.5 backdrop-blur-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${s.bg}`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground truncate">{s.label}</span>
              <div className={`p-1.5 rounded-lg ${s.iconBg} shrink-0`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-extrabold tracking-tight ${s.color}`}>
                  {isLoading ? "—" : s.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.sub}</p>
              </div>
              <div className="shrink-0">
                <MiniSparkline data={s.sparkline} color={s.sparkColor} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // PMS: Room Status Discrepancy & Audit KPIs
  if (activeTab === "room_discrepancy") {
    let sleepCount = 0;
    let skipCount = 0;
    let overcrowdedCount = 0;
    let oooOccupiedCount = 0;
    let staleDirtyCount = 0;

    rooms.forEach((r: any) => {
      const activeCount = assignments.filter((a: any) => a.roomId === r.id && (a.status === "ACTIVE" || a.status === "VACATION")).length;
      const rStatus = (r.status || "clean").toLowerCase();
      const cap = r.capacity || 1;

      if (activeCount === 0 && (rStatus === "occupied" || rStatus === "occupied_dirty")) sleepCount++;
      if (activeCount > 0 && (rStatus === "available" || rStatus === "clean")) skipCount++;
      if (activeCount > cap) overcrowdedCount++;
      if (activeCount > 0 && ["out_of_service", "out_of_order", "maintenance"].includes(rStatus)) oooOccupiedCount++;
      if (rStatus === "dirty" && activeCount === 0) staleDirtyCount++;
    });

    const totalCritical = sleepCount + skipCount + oooOccupiedCount;
    const totalDiscrepancies = totalCritical + overcrowdedCount + staleDirtyCount;
    const complianceRate = rooms.length > 0 ? Math.round(((rooms.length - totalCritical) / rooms.length) * 100) : 100;

    const discCards = [
      {
        label: ar ? "إجمالي حالات التباين" : "Total Discrepancies",
        value: totalDiscrepancies,
        sub: ar ? "بين التسكين والميدان" : "FO vs HK mismatches",
        color: totalDiscrepancies > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600",
        bg: "bg-card/75 border-border/50",
        icon: AlertTriangle,
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        sparkline: [4, 3, 5, 2, 4, totalDiscrepancies || 1],
        sparkColor: "#f59e0b",
      },
      {
        label: ar ? "تباين حرج (تفتيش عاجل)" : "Critical Discrepancies",
        value: totalCritical,
        sub: ar ? "Sleep / Skip / OOO" : "Immediate action required",
        color: totalCritical > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        bg: "bg-rose-500/5 border-rose-500/20",
        icon: AlertTriangle,
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        sparkline: [2, 1, 3, 1, 2, totalCritical || 0],
        sparkColor: "#ef4444",
      },
      {
        label: ar ? "نائم غير مسجل (Sleep)" : "Sleep Discrepancies",
        value: sleepCount,
        sub: ar ? "شاغر بالنظام ومشغول ميدانياً" : "Vacant in FO, Occ. in HK",
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-500/5 border-purple-500/20",
        icon: Users,
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        sparkline: [1, 2, 1, 0, 1, sleepCount || 0],
        sparkColor: "#a855f7",
      },
      {
        label: ar ? "غادر دون تسجيل (Skip)" : "Skip Discrepancies",
        value: skipCount,
        sub: ar ? "مشغول بالنظام ونظيف ميدانياً" : "Occ. in FO, Clean in HK",
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/5 border-indigo-500/20",
        icon: Clock,
        iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
        sparkline: [0, 1, 1, 2, 1, skipCount || 0],
        sparkColor: "#6366f1",
      },
      {
        label: ar ? "تجاوز السعة (تكدس)" : "Overcrowded Rooms",
        value: overcrowdedCount,
        sub: ar ? "المقيمين يتجاوزون الأسرة" : "Assigned > Bed Capacity",
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-500/5 border-orange-500/20",
        icon: BedDouble,
        iconBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
        sparkline: [1, 0, 1, 1, 0, overcrowdedCount || 0],
        sparkColor: "#ea580c",
      },
      {
        label: ar ? "نسبة مطابقة البيانات" : "PMS Audit Match Rate",
        value: `${complianceRate}%`,
        sub: ar ? "دقة التسكين الفعلي" : "System-Physical alignment",
        color: complianceRate >= 95 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
        bg: "bg-emerald-500/5 border-emerald-500/20",
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        sparkline: [92, 94, 95, 96, 98, complianceRate || 100],
        sparkColor: "#10b981",
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {discCards.map((s) => (
          <div
            key={s.label}
            className={`border rounded-2xl p-3.5 backdrop-blur-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${s.bg}`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground truncate">{s.label}</span>
              <div className={`p-1.5 rounded-lg ${s.iconBg} shrink-0`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-extrabold tracking-tight ${s.color}`}>
                  {isLoading ? "—" : s.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.sub}</p>
              </div>
              <div className="shrink-0">
                <MiniSparkline data={s.sparkline} color={s.sparkColor} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (activeTab === "equipment_inventory") {
    const totalQty = equipmentInventory.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);
    const goodQty = equipmentInventory
      .filter((it: any) => it.condition === "good" || it.condition === "fair")
      .reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);
    const repairQty = equipmentInventory
      .filter((it: any) => it.condition === "needs_repair")
      .reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);
    const damagedQty = equipmentInventory
      .filter((it: any) => it.condition === "damaged" || it.condition === "missing")
      .reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

    const distinctTypes = new Set(
      equipmentInventory.map((it: any) => (it.itemName || "").trim().toLowerCase()).filter(Boolean)
    ).size;

    const invCards = [
      {
        label: ar ? "إجمالي العهد بالسكن" : "Total Equipment in Housing",
        value: totalQty,
        sub: ar ? `${distinctTypes} صنف مسجل` : `${distinctTypes} asset types`,
        color: "text-foreground",
        bg: "bg-card/75 border-border/50",
        icon: PackageCheck,
        iconBg: "bg-primary/10 text-primary",
        sparkline: [30, 35, 38, 42, 45, 48, totalQty || 50],
        sparkColor: "#6366f1",
      },
      {
        label: ar ? "بحالة ممتازة / صالحة" : "Good Condition",
        value: goodQty,
        sub: totalQty > 0 ? `${Math.round((goodQty / totalQty) * 100)}% ${ar ? "من الإجمالي" : "of total"}` : "—",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/5 border-emerald-500/20",
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        sparkline: [25, 28, 32, 36, 40, 42, goodQty || 45],
        sparkColor: "#10b981",
      },
      {
        label: ar ? "بحاجة لصيانة وإصلاح" : "Needs Repair",
        value: repairQty,
        sub: ar ? "تتطلب فحص فني" : "Requires technician",
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-500/5 border-rose-500/20",
        icon: Wrench,
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        sparkline: [8, 6, 7, 5, 4, 3, repairQty || 2],
        sparkColor: "#ef4444",
      },
      {
        label: ar ? "تالف أو مفقود" : "Damaged / Missing",
        value: damagedQty,
        sub: ar ? "يتطلب استبدال عاجل" : "Requires replacement",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/5 border-amber-500/20",
        icon: AlertTriangle,
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        sparkline: [3, 2, 4, 3, 2, 1, damagedQty || 1],
        sparkColor: "#f59e0b",
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {invCards.map((s) => (
          <div
            key={s.label}
            className={`border rounded-2xl p-4 backdrop-blur-xl shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${s.bg}`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground truncate">{s.label}</span>
              <div className={`p-1.5 rounded-lg ${s.iconBg} shrink-0`}>
                <s.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div>
                <p className={`text-2xl font-extrabold tracking-tight ${s.color}`}>
                  {isLoading ? "—" : s.value}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
              <MiniSparkline data={s.sparkline} color={s.sparkColor} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: ar ? "إجمالي الغرف" : "Total Rooms",
      value: stats.totalRooms,
      sub: ar ? `السعة: ${stats.totalCapacity} سرير` : `Cap: ${stats.totalCapacity} beds`,
      color: "text-foreground",
      bg: "bg-card/75 border-border/50",
      icon: Home,
      iconBg: "bg-primary/10 text-primary",
      sparkline: [65, 70, 72, 75, 78, 80, stats.totalRooms || 80],
      sparkColor: "#6366f1",
      delta: { value: "+2.5%", isPositive: true },
    },
    {
      label: ar ? "الأسِرّة الشاغرة" : "Vacant Beds",
      value: stats.vacantBeds,
      sub: ar ? `${stats.vacantRooms} غرفة شاغرة` : `${stats.vacantRooms} vacant rooms`,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/5 border-emerald-500/20",
      icon: BedDouble,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      sparkline: [40, 38, 35, 30, 25, 20, stats.vacantBeds || 15],
      sparkColor: "#10b981",
      delta: { value: "متاحة", isPositive: true },
    },
    {
      label: ar ? "المقيمون حالياً" : "Current Occupants",
      value: stats.activeAss,
      sub: ar ? `${stats.occupiedRooms} غرفة مشغولة` : `${stats.occupiedRooms} rooms occ.`,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/5 border-blue-500/20",
      icon: Users,
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      sparkline: [40, 45, 48, 52, 55, 60, stats.activeAss || 65],
      sparkColor: "#3b82f6",
      delta: { value: "+4.1%", isPositive: true },
    },
    {
      label: ar ? "غرف تحت الصيانة" : "Maintenance / OOS",
      value: stats.maint,
      sub: ar ? "خارج التسكين" : "Out of order",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/5 border-rose-500/20",
      icon: Wrench,
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      sparkline: [5, 4, 6, 5, 3, 2, stats.maint || 2],
      sparkColor: "#ef4444",
      delta: stats.maint > 0 ? { value: `+${stats.maint}`, isPositive: false } : { value: "0", isPositive: true },
    },
    {
      label: ar ? "انتهاء عقود قريبة" : "Expiring Contracts",
      value: stats.expiringContracts,
      sub: ar ? "خلال 30 يوم" : "Within 30 days",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/5 border-amber-500/20",
      icon: Clock,
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      sparkline: [2, 3, 4, 3, 5, 4, stats.expiringContracts || 3],
      sparkColor: "#f59e0b",
      delta: { value: "متابعة", isNeutral: true },
    },
    {
      label: ar ? "حجوزات مستقبلية" : "Future Reservations",
      value: stats.upcomingRes,
      sub: ar ? "تنتظر التسكين" : "Awaiting check-in",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/5 border-purple-500/20",
      icon: CalendarCheck,
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      sparkline: [5, 7, 6, 9, 8, 10, stats.upcomingRes || 8],
      sparkColor: "#a855f7",
      delta: { value: "+2", isPositive: true },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((s) => (
        <div
          key={s.label}
          className={`border rounded-2xl p-3.5 backdrop-blur-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${s.bg}`}
        >
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground truncate">{s.label}</span>
            <div className={`p-1.5 rounded-lg ${s.iconBg} shrink-0`}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 mt-1">
            <div className="min-w-0">
              <p className={`text-xl sm:text-2xl font-extrabold tracking-tight ${s.color}`}>
                {isLoading ? "—" : s.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.sub}</p>
            </div>
            <div className="shrink-0">
              <MiniSparkline data={s.sparkline} color={s.sparkColor} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
