// Department ranking.
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderDepartmentRanking(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.departmentRanking &&
            reportData.departmentRanking.length > 0 && (
              <CollapsibleSection
                title={ar ? "ترتيب الأقسام" : "Department Ranking"}
                icon={<BarChart3 className="w-4 h-4" />}
                expanded={expandedSections.deptRanking !== false}
                onToggle={() => toggleSection("deptRanking")}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "القسم" : "Department"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "الموظفون" : "Profiles"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "الردود" : "Responses"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "نسبة الاستجابة" : "Response Rate"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "متوسط التقييم" : "Avg Rating"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.departmentRanking.map((d: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium">
                            {d.department}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {d.totalProfiles}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {d.responses}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant={
                                d.responseRate > 50 ? "default" : "outline"
                              }
                              className="text-xs"
                            >
                              {d.responseRate}%
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`font-bold ${d.avgRating >= 4 ? "text-green-600" : d.avgRating >= 3 ? "text-amber-600" : "text-red-600"}`}
                            >
                              {d.avgRating}
                            </span>
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
