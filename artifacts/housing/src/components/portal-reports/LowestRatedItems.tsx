// Lowest rated questions.
import { Star } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderLowestRatedItems(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.lowestItems && reportData.lowestItems.length > 0 && (
            <CollapsibleSection
              title={ar ? "أقل الأسئلة تقييماً" : "Lowest Rated Items"}
              icon={<Star className="w-4 h-4 text-red-500" />}
              expanded={expandedSections.lowestItems !== false}
              onToggle={() => toggleSection("lowestItems")}
            >
              <div className="space-y-2">
                {reportData.lowestItems.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                  >
                    <span className="text-lg font-bold text-red-500">
                      #{i + 1}
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
                      <Star className="w-4 h-4 text-red-400" />
                      <span className="font-bold text-red-600">
                        {item.avgRating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )
  );
}
