// Activities with no registrations.
import { formatDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderEmptyActivities(
  s: PortalReportsState,
  v: PortalReportsView,
  reportData: NonNullable<PortalReportsState["reportData"]>,
) {
  const { ar, expandedSections, toggleSection } = s;
  return (
    reportData.emptyActivities &&
    reportData.emptyActivities.length > 0 && (
      <CollapsibleSection
        title={
          ar
            ? `فعاليات بدون تسجيل (${reportData.emptyActivities.length})`
            : `Activities with No Registrations (${reportData.emptyActivities.length})`
        }
        icon={<Target className="w-4 h-4 text-muted-foreground" />}
        expanded={expandedSections.emptyAct !== false}
        onToggle={() => toggleSection("emptyAct")}
      >
        <div className="space-y-2">
          {reportData.emptyActivities.map((act: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/10 border border-dashed border-border"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {ar ? act.titleAr || act.titleEn : act.titleEn || act.titleAr}
                </p>
                <p className="text-xs text-muted-foreground">
                  {act.category || "—"} — {formatDate(act.startDate, "—")}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground"
              >
                {ar ? "صفر تسجيل" : "0 registrations"}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    )
  );
}
