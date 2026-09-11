import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { Users, User, ShieldCheck } from "lucide-react";

interface GenderDemographicsProps {
  genderDistribution?: {
    male: number;
    female: number;
  };
  totalResidents?: number;
  isLoading?: boolean;
}

export function GenderDemographicsCard({
  genderDistribution,
  totalResidents = 0,
}: GenderDemographicsProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const male = genderDistribution?.male ?? 0;
  const female = genderDistribution?.female ?? 0;
  const total = male + female || totalResidents || 1;

  const malePercent = Math.round((male / total) * 100);
  const femalePercent = Math.round((female / total) * 100);

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {ar ? "التوزيع النوعي للمقيمين" : "Resident Demographics"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {ar ? "توزيع وسعة السكن حسب الجنس" : "Gender allocation & capacity balance"}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          >
            <ShieldCheck className="w-3 h-3" />
            {ar ? "أجنحة مفصولة" : "Segregated"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Dual Stacked Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {ar ? "ذكور" : "Male"}: {male} ({malePercent}%)
            </span>
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {ar ? "إناث" : "Female"}: {female} ({femalePercent}%)
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden flex p-0.5 gap-1 border border-border/40">
            <div
              style={{ width: `${Math.max(malePercent, 5)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 shadow-xs"
            />
            <div
              style={{ width: `${Math.max(femalePercent, 5)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600 transition-all duration-700 shadow-xs"
            />
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>{ar ? "أجنحة الذكور" : "Male Wings"}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                {malePercent}%
              </span>
            </div>
            <p className="text-xl font-extrabold text-foreground font-mono">{male}</p>
            <span className="text-[10px] text-muted-foreground mt-1">
              {ar ? "نزيل مسكن حالياً" : "Active male residents"}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>{ar ? "أجنحة الإناث" : "Female Wings"}</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                {femalePercent}%
              </span>
            </div>
            <p className="text-xl font-extrabold text-foreground font-mono">{female}</p>
            <span className="text-[10px] text-muted-foreground mt-1">
              {ar ? "نزيلة مسكنة حالياً" : "Active female residents"}
            </span>
          </div>
        </div>

        {/* Total Occupancy Note */}
        <div className="text-[11px] text-muted-foreground/80 bg-muted/40 p-2.5 rounded-lg border border-border/30 flex items-center justify-between">
          <span>{ar ? "إجمالي الطاقة المشغولة:" : "Total Resident Occupancy:"}</span>
          <span className="font-bold text-foreground font-mono">{male + female} {ar ? "نزيل" : "residents"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
