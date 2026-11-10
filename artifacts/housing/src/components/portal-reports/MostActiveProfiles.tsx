// Most active residents.
import { Users } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderMostActiveProfiles(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.mostActive && reportData.mostActive.length > 0 && (
            <CollapsibleSection
              title={ar ? "الموظفون الأكثر نشاطاً" : "Most Active Profiles"}
              icon={<Users className="w-4 h-4" />}
              expanded={expandedSections.mostActive !== false}
              onToggle={() => toggleSection("mostActive")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        #
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "الاسم" : "Name"}
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "القسم" : "Department"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "تقييمات" : "Evaluations"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "فعاليات" : "Activities"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "إجمالي" : "Total"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.mostActive.map((e: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3 font-bold text-primary">
                          {i + 1}
                        </td>
                        <td className="py-2 px-3 font-medium">{e.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {e.department}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {e.evaluations}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {e.activities}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          {e.totalEngagement}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )
  );
}
