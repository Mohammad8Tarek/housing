// Activities list.
import { Target } from "lucide-react";
import { BarChart, CollapsibleSection } from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderActivitiesList(
  s: PortalReportsState,
  v: PortalReportsView,
  reportData: NonNullable<PortalReportsState["reportData"]>,
) {
  const { ar, expandedSections, toggleSection } = s;
  return (
    reportData.activities &&
    reportData.activities.map((act: any) => (
      <CollapsibleSection
        key={act.activityId}
        title={ar ? act.titleAr || act.titleEn : act.titleEn || act.titleAr}
        icon={<Target className="w-4 h-4" />}
        expanded={expandedSections[`act_${act.activityId}`] !== false}
        onToggle={() => toggleSection(`act_${act.activityId}`)}
      >
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/20">
            <p className="text-lg font-bold">{act.totalRegistered}</p>
            <p className="text-xs text-muted-foreground">
              {ar ? "مسجل" : "Registered"}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/20">
            <p className="text-lg font-bold">{act.joinedCount}</p>
            <p className="text-xs text-muted-foreground">
              {ar ? "منضم" : "Joined"}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/20">
            <p className="text-lg font-bold text-green-600">
              {act.attendedCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {ar ? "حاضر" : "Attended"}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/20">
            <p className="text-lg font-bold text-amber-600">
              {act.attendanceRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {ar ? "نسبة الحضور" : "Attendance"}
            </p>
          </div>
        </div>
        {act.departmentBreakdown && act.departmentBreakdown.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">
              {ar ? "تحليل الأقسام" : "Department Breakdown"}
            </p>
            <BarChart
              data={act.departmentBreakdown.map((d: any) => ({
                label: d.department,
                value: d.registered,
                color: "bg-blue-500",
              }))}
            />
          </div>
        )}
      </CollapsibleSection>
    ))
  );
}
