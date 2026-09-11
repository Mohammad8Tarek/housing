import React, { useState, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Users,
  Search,
  BarChart3,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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

const DEPT_GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-sky-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-purple-500 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
  "from-teal-500 to-emerald-600",
  "from-yellow-500 to-amber-600",
  "from-red-500 to-rose-600",
];

const DEPT_TEXT_COLORS = [
  "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/60",
  "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60",
  "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60",
  "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60",
  "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60",
  "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60",
];

export function DepartmentBarList({
  departments = [],
  totalProfiles = 0,
  isLoading,
}: DepartmentBarListProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [viewFormat, setViewFormat] = useState<"bars" | "grid" | "table">("bars");
  const [filterScope, setFilterScope] = useState<"all" | "top5">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Filtered & searched departments
  const filteredDepartments = useMemo(() => {
    let list = [...departments];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => d.name?.toLowerCase().includes(q));
    }
    if (filterScope === "top5") {
      list = list.slice(0, 5);
    }
    return list;
  }, [departments, searchQuery, filterScope]);

  const maxCount = Math.max(1, ...departments.map((d) => d.count));
  const topDept = departments.length > 0 ? departments[0] : null;

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
      {/* ── Header with Controls ── */}
      <CardHeader className="pb-3 border-b border-border/30 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>{ar ? "توزيع الإسكان حسب الأقسام" : "Housing by Department"}</span>
                <Badge variant="secondary" className="text-[11px] font-mono px-2 py-0">
                  {departments.length} {ar ? "قسم" : "depts"}
                </Badge>
              </CardTitle>
            </div>
          </div>

          {/* Quick Controls: Format Switcher & Search Toggle */}
          <div className="flex items-center gap-1.5">
            {/* Search Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery("");
              }}
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                showSearch || searchQuery
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-background"
              }`}
              title={ar ? "بحث في الأقسام" : "Search departments"}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* View Format Switcher (Bars / Grid / Table) */}
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/70 rounded-lg border border-border/40 text-xs">
              <button
                type="button"
                onClick={() => setViewFormat("bars")}
                className={`p-1.5 rounded-md transition-all ${
                  viewFormat === "bars"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض الأشرطة البيانية" : "Bar List"}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewFormat("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewFormat === "grid"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض البطاقات المدمجة" : "Grid Cards"}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewFormat("table")}
                className={`p-1.5 rounded-md transition-all ${
                  viewFormat === "table"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض جدول مختصر" : "Mini Table"}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Search Input & Scope Switcher */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Top 5 vs All Scope Pills */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterScope("all")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterScope === "all"
                  ? "bg-foreground text-background shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {ar ? `كل الأقسام (${departments.length})` : `All (${departments.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("top5")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterScope === "top5"
                  ? "bg-foreground text-background shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {ar ? "أعلى 5 فقط" : "Top 5"}
            </button>
          </div>

          {/* Inline Search Bar */}
          <AnimatePresence>
            {(showSearch || searchQuery) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "160px" }}
                exit={{ opacity: 0, width: 0 }}
                className="relative"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={ar ? "بحث..." : "Filter..."}
                  className="w-full text-xs px-2.5 py-1 rounded-md bg-muted/60 border border-border/70 focus:outline-none focus:border-primary text-foreground pr-6"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardHeader>

      {/* ── Content Body (Scrollable with max-h to prevent layout break) ── */}
      <CardContent className="pt-3 flex-1 flex flex-col justify-between">
        {filteredDepartments.length > 0 ? (
          <div className="max-h-[340px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {/* 1. Bar Progress Mode */}
            {viewFormat === "bars" && (
              <div className="space-y-3 py-0.5">
                {filteredDepartments.map((dept, index) => {
                  const fillPercent = Math.max(6, Math.round((dept.count / maxCount) * 100));
                  const gradient = DEPT_GRADIENTS[index % DEPT_GRADIENTS.length];
                  const rank = index + 1;

                  return (
                    <div key={dept.name || index} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate max-w-[190px] sm:max-w-[240px]">
                          <span
                            className={`text-[10px] font-bold font-mono w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                              rank === 1
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                                : rank === 2
                                ? "bg-slate-300/40 text-slate-700 dark:text-slate-300 border border-slate-400/40"
                                : rank === 3
                                ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/40"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : rank}
                          </span>
                          <span
                            className="font-semibold text-foreground truncate group-hover:text-primary transition-colors"
                            title={dept.name}
                          >
                            {dept.name || (ar ? "عام" : "General")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-foreground">
                            {dept.count} <span className="text-[10px] font-normal text-muted-foreground">{ar ? "نزيل" : "staff"}</span>
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold bg-muted text-foreground/80 border border-border/50">
                            {dept.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Horizontal Bar with animated width and gradient */}
                      <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${fillPercent}%` }}
                          transition={{ duration: 0.6, delay: index * 0.04, ease: "easeOut" }}
                          className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-2xs group-hover:brightness-110 transition-all`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Compact Grid Mode */}
            {viewFormat === "grid" && (
              <div className="grid grid-cols-2 gap-2.5 py-0.5">
                {filteredDepartments.map((dept, index) => {
                  const tone = DEPT_TEXT_COLORS[index % DEPT_TEXT_COLORS.length];
                  const rank = index + 1;

                  return (
                    <div
                      key={dept.name || index}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 hover:shadow-xs transition-all ${tone}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold truncate max-w-[110px]" title={dept.name}>
                          {dept.name || (ar ? "عام" : "General")}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-background/80 shadow-2xs">
                          #{rank}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-lg font-bold font-mono tracking-tight leading-none">
                          {dept.count}
                        </span>
                        <span className="text-[11px] font-semibold opacity-85">
                          {dept.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Mini Table Mode */}
            {viewFormat === "table" && (
              <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="py-2 px-2.5 text-start font-semibold w-10">#</th>
                      <th className="py-2 px-2.5 text-start font-semibold">{ar ? "القسم" : "Department"}</th>
                      <th className="py-2 px-2.5 text-center font-semibold">{ar ? "العدد" : "Staff"}</th>
                      <th className="py-2 px-2.5 text-end font-semibold">{ar ? "النسبة" : "Share"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredDepartments.map((dept, index) => (
                      <tr key={dept.name || index} className="hover:bg-muted/30 transition-colors">
                        <td className="py-1.5 px-2.5 font-mono text-muted-foreground font-semibold">
                          {index + 1}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-foreground truncate max-w-[140px]" title={dept.name}>
                          {dept.name || (ar ? "عام" : "General")}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-bold font-mono text-foreground">
                          {dept.count}
                        </td>
                        <td className="py-1.5 px-2.5 text-end font-mono text-muted-foreground font-semibold">
                          {dept.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
            <Building2 className="w-8 h-8 opacity-20" />
            <p>{searchQuery ? (ar ? "لا توجد نتائج مطابقة للبحث" : "No matching departments") : (ar ? "لا توجد بيانات أقسام مسجلة" : "No department records found")}</p>
          </div>
        )}

        {/* ── Footer Insight & Total Summary ── */}
        <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground gap-2">
          {topDept ? (
            <div className="flex items-center gap-1.5 truncate">
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate text-[11px]">
                {ar ? "الأعلى استيعاباً:" : "Top:"}{" "}
                <strong className="text-foreground font-semibold">{topDept.name}</strong> ({topDept.percentage}%)
              </span>
            </div>
          ) : (
            <span />
          )}
          <div className="shrink-0 text-end">
            <span>{ar ? "إجمالي النزلاء:" : "Total Staff:"}{" "}</span>
            <strong className="text-foreground font-mono text-sm">{totalProfiles}</strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

