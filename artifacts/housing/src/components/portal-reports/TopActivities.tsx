// Most registered activities.
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderTopActivities(
  s: PortalReportsState,
  v: PortalReportsView,
  reportData: NonNullable<PortalReportsState["reportData"]>,
) {
  const { ar, expandedSections, toggleSection } = s;
  return (
    reportData.topActivities &&
    reportData.topActivities.length > 0 && (
      <CollapsibleSection
        title={ar ? "أكثر الفعاليات تسجيلاً" : "Top Activities"}
        icon={<Target className="w-4 h-4" />}
        expanded={expandedSections.topAct !== false}
        onToggle={() => toggleSection("topAct")}
      >
        <div className="space-y-2">
          {reportData.topActivities.map((act: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
            >
              <span className="text-lg font-bold text-blue-500">#{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {ar ? act.titleAr || act.titleEn : act.titleEn || act.titleAr}
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
      </CollapsibleSection>
    )
  );
}
