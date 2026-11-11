// Per-section evaluation breakdown.
import { Badge } from "@/components/ui/badge";
import { BarChart3, Star } from "lucide-react";
import {
  BarChart,
  StarBar,
  CollapsibleSection,
} from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderEvaluationSections(
  s: PortalReportsState,
  v: PortalReportsView,
  reportData: NonNullable<PortalReportsState["reportData"]>,
) {
  const { ar, expandedSections, toggleSection } = s;
  return (
    reportData.sections &&
    reportData.sections.map((section: any, i: number) => (
      <CollapsibleSection
        key={i}
        title={
          ar
            ? section.titleAr || section.title
            : section.title || section.titleAr
        }
        icon={<BarChart3 className="w-4 h-4" />}
        expanded={expandedSections[`section_${i}`] !== false}
        onToggle={() => toggleSection(`section_${i}`)}
      >
        {/* Summary */}
        {section.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {Object.entries(section.summary)
              .filter(([k]) => !["modulesGenerated", "modules"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-muted/20 text-center">
                  <p className="text-lg font-bold">{String(v)}</p>
                  <p className="text-xs text-muted-foreground">
                    {k
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())}
                  </p>
                </div>
              ))}
          </div>
        )}
        {/* Top Items */}
        {section.topItems && section.topItems.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "أعلى الأسئلة تقييماً" : "Top Rated Items"}
            </p>
            <div className="space-y-1.5">
              {section.topItems.map((item: any, j: number) => (
                <div
                  key={j}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                >
                  <span className="text-sm font-bold text-amber-500">
                    #{j + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {ar
                        ? item.titleAr || item.titleEn
                        : item.titleEn || item.titleAr}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.responseCount} {ar ? "رد" : "responses"} —{" "}
                      {item.responseRate}%
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-amber-600">
                      {item.avgRating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Top Activities */}
        {section.topActivities && section.topActivities.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "أكثر الفعاليات تسجيلاً" : "Top Activities"}
            </p>
            <div className="space-y-1.5">
              {section.topActivities.map((act: any, j: number) => (
                <div
                  key={j}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                >
                  <span className="text-sm font-bold text-blue-500">
                    #{j + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {ar
                        ? act.titleAr || act.titleEn
                        : act.titleEn || act.titleAr}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {act.totalRegistered} {ar ? "مسجل" : "registered"}
                    </p>
                  </div>
                  <Badge
                    variant={act.attendanceRate > 50 ? "default" : "outline"}
                    className="text-xs"
                  >
                    {act.attendanceRate}% {ar ? "حضور" : "attendance"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Most Active Profiles */}
        {section.mostActive && section.mostActive.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "الموظفون الأكثر نشاطاً" : "Most Active Profiles"}
            </p>
            <div className="space-y-1.5">
              {section.mostActive.map((emp: any, j: number) => (
                <div
                  key={j}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                >
                  <span className="text-sm font-bold text-primary">
                    #{j + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {emp.department}
                    </p>
                  </div>
                  <span className="text-sm font-bold">
                    {emp.totalEngagement} {ar ? "نشاط" : "engagements"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Department Ranking */}
        {section.departmentRanking && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "ترتيب الأقسام" : "Department Ranking"}
            </p>
            <BarChart
              data={section.departmentRanking.map((d: any) => ({
                label: d.department,
                value: d.avgRating,
                color: "bg-green-500",
              }))}
            />
          </div>
        )}
        {/* Department Summary */}
        {section.departmentSummary && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "ملخص الأقسام" : "Department Summary"}
            </p>
            <BarChart
              data={section.departmentSummary.map((d: any) => ({
                label: d.department,
                value: d.registered,
                color: "bg-blue-500",
              }))}
            />
          </div>
        )}
        {/* Department Engagement */}
        {section.departmentEngagement && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "مشاركة الأقسام" : "Department Engagement"}
            </p>
            <BarChart
              data={section.departmentEngagement.map((d: any) => ({
                label: d.department,
                value: d.overallScore,
                color: "bg-purple-500",
              }))}
            />
          </div>
        )}
        {/* Data details (templates/activities in custom sections) */}
        {section.data && section.data.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{ar ? "التفاصيل" : "Details"}</p>
            {section.data.map((item: any, j: number) => (
              <div
                key={j}
                className="p-3 rounded-lg bg-muted/10 border border-border"
              >
                <p className="text-sm font-medium mb-1">
                  {ar
                    ? item.titleAr || item.titleEn
                    : item.titleEn || item.titleAr}
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {item.totalResponses !== undefined && (
                    <span>
                      {ar ? "ردود" : "Responses"}: {item.totalResponses}
                    </span>
                  )}
                  {item.responseRate !== undefined && (
                    <span>
                      {ar ? "نسبة الاستجابة" : "Rate"}: {item.responseRate}%
                    </span>
                  )}
                  {item.overallAvgRating !== undefined && (
                    <span>
                      {ar ? "متوسط التقييم" : "Avg"}: {item.overallAvgRating}
                    </span>
                  )}
                  {item.totalRegistered !== undefined && (
                    <span>
                      {ar ? "مسجل" : "Registered"}: {item.totalRegistered}
                    </span>
                  )}
                  {item.attendedCount !== undefined && (
                    <span>
                      {ar ? "حاضر" : "Attended"}: {item.attendedCount}
                    </span>
                  )}
                  {item.attendanceRate !== undefined && (
                    <span>
                      {ar ? "نسبة الحضور" : "Att. Rate"}: {item.attendanceRate}%
                    </span>
                  )}
                </div>
                {item.starDistribution && (
                  <div className="mt-2">
                    <StarBar distribution={item.starDistribution} />
                  </div>
                )}
                {item.departmentBreakdown &&
                  item.departmentBreakdown.length > 0 && (
                    <div className="mt-2">
                      <BarChart
                        data={item.departmentBreakdown.map((d: any) => ({
                          label: d.department,
                          value: d.responseCount || d.registered || 0,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    ))
  );
}
