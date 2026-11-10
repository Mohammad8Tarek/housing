// Top rated questions.
import { Star } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderTopRatedItems(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.topItems && reportData.topItems.length > 0 && (
            <CollapsibleSection
              title={ar ? "أعلى الأسئلة تقييماً" : "Top Rated Items"}
              icon={<Star className="w-4 h-4" />}
              expanded={expandedSections.topItems !== false}
              onToggle={() => toggleSection("topItems")}
            >
              <div className="space-y-2">
                {reportData.topItems.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                  >
                    <span className="text-lg font-bold text-amber-500">
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
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-amber-600">
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
