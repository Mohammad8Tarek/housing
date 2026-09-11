import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BedDouble, CheckCircle2, Sparkles, Wrench, AlertCircle } from "lucide-react";

interface DonutDataProps {
  roomStatusBreakdown?: {
    total: number;
    available: number;
    occupied: number;
    dirty: number;
    maintenance: number;
    occupancyRate: number;
  };
  bedCapacity?: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    utilizationPercent: number;
  };
  isLoading?: boolean;
}

export function DashboardAnalyticsDonut({
  roomStatusBreakdown,
  bedCapacity,
  isLoading,
}: DonutDataProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const totalRooms = roomStatusBreakdown?.total || 0;
  const available = roomStatusBreakdown?.available || 0;
  const occupied = roomStatusBreakdown?.occupied || 0;
  const dirty = roomStatusBreakdown?.dirty || 0;
  const maintenance = roomStatusBreakdown?.maintenance || 0;
  const occupancyRate = roomStatusBreakdown?.occupancyRate || 0;

  const data = [
    {
      name: ar ? "جاهزة ونظيفة" : "Ready & Clean",
      value: available,
      color: "#10b981", // Emerald
      icon: CheckCircle2,
    },
    {
      name: ar ? "مشغولة حالياً" : "Occupied",
      value: occupied,
      color: "#6366f1", // Indigo
      icon: BedDouble,
    },
    {
      name: ar ? "بانتظار النظافة" : "Pending Clean",
      value: dirty,
      color: "#f59e0b", // Amber
      icon: Sparkles,
    },
    {
      name: ar ? "تحت الصيانة" : "Out of Order",
      value: maintenance,
      color: "#ef4444", // Red
      icon: Wrench,
    },
  ].filter((item) => item.value > 0);

  const fallbackData = [{ name: ar ? "لا توجد غرف" : "No Rooms", value: 1, color: "#94a3b8" }];
  const chartData = data.length > 0 ? data : fallbackData;

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-primary" />
              {ar ? "حالة الغرف والجاهزية" : "Room Readiness & Status"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {ar
                ? "توزيع الغرف حسب الجاهزية التشغيلية"
                : "Operational distribution by room condition"}
            </CardDescription>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {occupancyRate}% {ar ? "إشغال" : "Occ."}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-2 flex-1 flex flex-col justify-between">
        {/* Donut Chart Container with Center Metric */}
        <div className="relative w-full h-[200px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0];
                    const percent = totalRooms > 0 ? ((Number(d.value) / totalRooms) * 100).toFixed(1) : "0";
                    return (
                      <div className="bg-card/95 backdrop-blur-md border border-border shadow-lg rounded-xl p-2.5 text-xs">
                        <div className="flex items-center gap-2 font-semibold">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: d.payload.color }}
                          />
                          <span>{d.name}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          <span className="font-bold text-foreground text-sm">{d.value}</span>{" "}
                          {ar ? "غرفة" : "rooms"} ({percent}%)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={84}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Absolute Metric */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">
              {totalRooms}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {ar ? "إجمالي الغرف" : "Total Rooms"}
            </span>
          </div>
        </div>

        {/* Legend / Breakdown Pills */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground truncate">
                {ar ? "جاهزة" : "Available"}
              </div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {available} <span className="text-[10px] font-normal text-muted-foreground/80">({totalRooms > 0 ? Math.round((available / totalRooms) * 100) : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-indigo-500/8 border border-indigo-500/15">
            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground truncate">
                {ar ? "مشغولة" : "Occupied"}
              </div>
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {occupied} <span className="text-[10px] font-normal text-muted-foreground/80">({totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground truncate">
                {ar ? "نظافة" : "Dirty"}
              </div>
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {dirty} <span className="text-[10px] font-normal text-muted-foreground/80">({totalRooms > 0 ? Math.round((dirty / totalRooms) * 100) : 0}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-rose-500/8 border border-rose-500/15">
            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground truncate">
                {ar ? "صيانة" : "Maintenance"}
              </div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                {maintenance} <span className="text-[10px] font-normal text-muted-foreground/80">({totalRooms > 0 ? Math.round((maintenance / totalRooms) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bed Capacity Summary Footer */}
        {bedCapacity && bedCapacity.totalBeds > 0 && (
          <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {ar ? "استيعاب الأسرة:" : "Bed Capacity:"}{" "}
              <strong className="text-foreground">{bedCapacity.occupiedBeds}</strong> / {bedCapacity.totalBeds}
            </span>
            <span className="font-semibold text-primary font-mono">
              {bedCapacity.utilizationPercent}% {ar ? "استغلال" : "Used"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
