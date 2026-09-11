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

export function StatsCards({ stats, isLoading, ar, activeTab, equipmentInventory = [] }: StatsCardsProps) {
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
