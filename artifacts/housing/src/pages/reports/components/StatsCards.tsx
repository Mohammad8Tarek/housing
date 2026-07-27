interface StatsCardsProps {
  stats: {
    total: number;
    available: number;
    occupied: number;
    maint: number;
    employees: number;
    activeAss: number;
  };
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const cards = [
    { label: "Total Rooms", value: stats.total, color: "text-foreground" },
    { label: "Available", value: stats.available, color: "text-green-600" },
    { label: "Occupied", value: stats.occupied, color: "text-blue-600" },
    { label: "Maintenance", value: stats.maint, color: "text-orange-600" },
    { label: "Employees", value: stats.employees, color: "text-purple-600" },
    { label: "Active Stays", value: stats.activeAss, color: "text-indigo-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((s) => (
        <div key={s.label} className="bg-card border rounded-lg p-3 text-center shadow-sm">
          <p className={`text-xl font-bold ${s.color}`}>
            {isLoading ? "—" : s.value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
