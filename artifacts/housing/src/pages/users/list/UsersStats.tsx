// Users list: KPI stat cards.
import { ShieldCheck, Users, Crown, Briefcase, Headphones, Wrench } from "lucide-react";
import type { UsersPageState } from "./useUsersPageState";

export function renderUsersStats(s: UsersPageState) {
  const { ar, stats } = s;
  return (
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: ar ? "إجمالي المستخدمين" : "Total Users",
            count: stats.total,
            icon: Users,
            color:
              "from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800/40",
            iconColor: "text-blue-600 dark:text-blue-400",
          },
          {
            label: ar ? "سوبر أدمن" : "Super Admin",
            count: stats.superAdmin,
            icon: Crown,
            color:
              "from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800/40",
            iconColor: "text-purple-600 dark:text-purple-400",
          },
          {
            label: ar ? "أدمن" : "Admin",
            count: stats.admin,
            icon: ShieldCheck,
            color:
              "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800/40",
            iconColor: "text-red-600 dark:text-red-400",
          },
          {
            label: ar ? "مدير" : "Manager",
            count: stats.manager,
            icon: Briefcase,
            color:
              "from-sky-500/10 to-sky-600/5 border-sky-200 dark:border-sky-800/40",
            iconColor: "text-sky-600 dark:text-sky-400",
          },
          {
            label: ar ? "استقبال" : "Receptionist",
            count: stats.receptionist,
            icon: Headphones,
            color:
              "from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800/40",
            iconColor: "text-green-600 dark:text-green-400",
          },
          {
            label: ar ? "صيانة" : "Maintenance",
            count: stats.maintenance,
            icon: Wrench,
            color:
              "from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800/40",
            iconColor: "text-orange-600 dark:text-orange-400",
          },
        ].map((card, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-4 transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-2xl font-bold mt-1">{card.count}</p>
              </div>
              <card.icon className={`w-8 h-8 ${card.iconColor} opacity-60`} />
            </div>
          </div>
        ))}
      </div>
  );
}
