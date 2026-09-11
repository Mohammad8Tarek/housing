import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { Building2, BedDouble, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface BuildingOccupancy {
  buildingId: number;
  buildingName: string;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  totalCapacity: number;
  totalOccupancy: number;
  occupancyRate: number;
}

interface BuildingCapacityMatrixProps {
  buildings?: BuildingOccupancy[];
  buildNavHref: (path: string) => string;
}

export function BuildingCapacityMatrix({
  buildings = [],
  buildNavHref,
}: BuildingCapacityMatrixProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (!buildings || buildings.length === 0) return null;

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {ar ? "مصفوفة استيعاب وإشغال المباني" : "Building Capacity Matrix"}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {ar ? "معدلات الإشغال والأسرة الشاغرة لكل منشأة سكنية" : "Live occupancy & vacant beds per residential building"}
          </CardDescription>
        </div>
        <Link href={buildNavHref("/housing")}>
          <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent gap-1 py-1">
            {ar ? "إدارة المباني" : "Manage Buildings"} <ArrowUpRight className="w-3 h-3" />
          </Badge>
        </Link>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => {
            const vacantBeds = Math.max(0, b.totalCapacity - b.totalOccupancy);
            const isHigh = b.occupancyRate >= 85;
            const isMedium = b.occupancyRate >= 60 && b.occupancyRate < 85;

            return (
              <div
                key={b.buildingId}
                className="p-3.5 rounded-xl border border-border/50 bg-card/60 hover:bg-muted/60 transition-all duration-200 flex flex-col justify-between gap-3 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {b.buildingName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {b.totalRooms} {ar ? "غرفة" : "rooms"} · {b.totalCapacity} {ar ? "سرير" : "beds"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0",
                      isHigh
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : isMedium
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                    )}
                  >
                    {b.occupancyRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(b.occupancyRate, 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isHigh
                          ? "bg-gradient-to-r from-amber-500 to-rose-500"
                          : isMedium
                          ? "bg-gradient-to-r from-primary to-amber-500"
                          : "bg-gradient-to-r from-teal-500 to-emerald-500",
                      )}
                    />
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3 h-3 text-muted-foreground" />
                    {ar ? "شاغر:" : "Vacant:"}{" "}
                    <strong className="text-foreground font-mono">{vacantBeds}</strong> {ar ? "سرير" : "beds"}
                  </span>
                  <span>
                    {ar ? "مشغول:" : "Occupied:"}{" "}
                    <strong className="text-foreground font-mono">{b.occupiedRooms}</strong> / {b.totalRooms}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
