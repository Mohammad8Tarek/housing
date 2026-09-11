import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users } from "lucide-react";
import { motion } from "framer-motion";

interface DepartmentItem {
  name: string;
  count: number;
  percentage: number;
}

interface DepartmentBarListProps {
  departments?: DepartmentItem[];
  totalProfiles?: number;
  isLoading?: boolean;
}

const DEPT_COLORS = [
  "from-violet-500 to-indigo-500",
  "from-blue-500 to-sky-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-purple-500 to-indigo-600",
];

export function DepartmentBarList({
  departments = [],
  totalProfiles = 0,
  isLoading,
}: DepartmentBarListProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const maxCount = Math.max(1, ...departments.map((d) => d.count));

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {ar ? "توزيع الإسكان حسب الأقسام" : "Housing by Department"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {ar
                ? "أعلى الأقسام استهلاكاً للسكن والأسرة"
                : "Top departments by resident headcount"}
            </CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">
            {departments.length} {ar ? "أقسام رئيسية" : "depts"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-2 flex-1 flex flex-col justify-between">
        {departments.length > 0 ? (
          <div className="space-y-3.5 py-1">
            {departments.map((dept, index) => {
              const fillPercent = Math.max(8, Math.round((dept.count / maxCount) * 100));
              const gradient = DEPT_COLORS[index % DEPT_COLORS.length];

              return (
                <div key={dept.name || index} className="space-y-1.5 group">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[170px] sm:max-w-[220px]" title={dept.name}>
                      {dept.name || (ar ? "عام" : "General")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-foreground">
                        {dept.count} <span className="text-[10px] font-normal text-muted-foreground">{ar ? "موظف" : "staff"}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                        {dept.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar with animated width and gradient */}
                  <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${fillPercent}%` }}
                      transition={{ duration: 0.8, delay: index * 0.08, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-xs group-hover:brightness-110 transition-all`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
            <Building2 className="w-8 h-8 opacity-20" />
            <p>{ar ? "لا توجد بيانات أقسام مسجلة" : "No department records found"}</p>
          </div>
        )}

        <div className="mt-4 pt-2.5 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>{ar ? "إجمالي النزلاء المسجلين:" : "Total Registered Staff:"}</span>
          <strong className="text-foreground font-mono">{totalProfiles}</strong>
        </div>
      </CardContent>
    </Card>
  );
}
