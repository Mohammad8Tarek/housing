import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { Sparkles, BedDouble, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface DirtyRoom {
  id: number;
  roomNumber: string;
  capacity?: number;
  status: string;
  buildingName?: string;
  floorId?: number;
}

interface HousekeepingPriorityQueueProps {
  dirtyRooms?: DirtyRoom[];
  cleanRate?: number;
  pendingClean?: number;
  readyCount?: number;
  buildNavHref: (path: string) => string;
}

export function HousekeepingPriorityQueue({
  dirtyRooms = [],
  cleanRate = 100,
  pendingClean = 0,
  readyCount = 0,
  buildNavHref,
}: HousekeepingPriorityQueueProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {ar ? "طابور جاهزية ونظافة الغرف" : "Housekeeping Turnover Queue"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {ar ? "متابعة تجهيز ونظافة الغرف للقادمين الجدد" : "Room turnover & cleaning priority list"}
              </CardDescription>
            </div>
          </div>

          <Link href={buildNavHref("/housekeeping")}>
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent gap-1 py-1">
              {ar ? "جدول النظافة" : "Turnover Board"} <ArrowUpRight className="w-3 h-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        {/* KPI Pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-muted-foreground block">{ar ? "بحاجة لنظافة" : "Pending Clean"}</span>
            <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {pendingClean || dirtyRooms.length}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-muted-foreground block">{ar ? "جاهزة ومتاحة" : "Clean & Ready"}</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {readyCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-[10px] text-muted-foreground block">{ar ? "معدل الجاهزية" : "Clean Rate"}</span>
            <span className="text-sm sm:text-base font-extrabold text-primary font-mono">
              {cleanRate}%
            </span>
          </div>
        </div>

        {/* Dirty Rooms Queue List */}
        <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
          {dirtyRooms && dirtyRooms.length > 0 ? (
            dirtyRooms.slice(0, 5).map((r) => (
              <Link key={r.id} href={buildNavHref("/housekeeping")}>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 font-bold font-mono">
                      {r.roomNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {ar ? "الغرفة" : "Room"} {r.roomNumber}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.buildingName || (ar ? "المبنى الرئيسي" : "Main Building")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <BedDouble className="w-3 h-3" />
                      {r.capacity || 1} {ar ? "سرير" : "beds"}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 px-1.5 py-0"
                    >
                      {ar ? "بحاجة لتنظيف" : "Dirty"}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground gap-1.5">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 opacity-80" />
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {ar ? "كافة الغرف نظيفة وجاهزة تماماً!" : "All rooms are clean & turnover complete!"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
