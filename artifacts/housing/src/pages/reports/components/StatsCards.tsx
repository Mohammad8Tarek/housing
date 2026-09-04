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
}

export function StatsCards({ stats, isLoading, ar }: StatsCardsProps) {
  const cards = [
    {
      label: ar ? "إجمالي الغرف" : "Total Rooms",
      value: stats.totalRooms,
      sub: ar ? `السعة: ${stats.totalCapacity} سرير` : `Cap: ${stats.totalCapacity} beds`,
      color: "text-foreground",
      bg: "bg-card",
    },
    {
      label: ar ? "الأسِرّة الشاغرة" : "Vacant Beds",
      value: stats.vacantBeds,
      sub: ar ? `${stats.vacantRooms} غرفة شاغرة` : `${stats.vacantRooms} vacant rooms`,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40",
    },
    {
      label: ar ? "المقيمون حالياً" : "Current Occupants",
      value: stats.activeAss,
      sub: ar ? `${stats.occupiedRooms} غرفة مشغولة` : `${stats.occupiedRooms} rooms occ.`,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40",
    },
    {
      label: ar ? "غرف تحت الصيانة" : "Maintenance / OOS",
      value: stats.maint,
      sub: ar ? "خارج التسكين" : "Out of order",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40",
    },
    {
      label: ar ? "انتهاء عقود قريبة" : "Expiring Contracts",
      value: stats.expiringContracts,
      sub: ar ? "خلال 30 يوم" : "Within 30 days",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40",
    },
    {
      label: ar ? "حجوزات مستقبلية" : "Future Reservations",
      value: stats.upcomingRes,
      sub: ar ? "تنتظر التسكين" : "Awaiting check-in",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/60 dark:border-purple-900/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((s) => (
        <div
          key={s.label}
          className={`border rounded-xl p-3 text-center shadow-xs transition-shadow hover:shadow-sm ${s.bg}`}
        >
          <p className={`text-2xl font-bold tracking-tight ${s.color}`}>
            {isLoading ? "—" : s.value}
          </p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{s.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
