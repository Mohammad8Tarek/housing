// Charts.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { BarChart, StarBar } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderChartsCard(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar } = s;
  return (
reportData.charts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {ar ? "الرسوم البيانية" : "Charts"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reportData.starDistribution && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "توزيع التقييمات" : "Rating Distribution"}
                      </p>
                      <StarBar distribution={reportData.starDistribution} />
                    </div>
                  )}
                  {reportData.charts.departmentScores && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "ترتيب الأقسام" : "Department Scores"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.departmentScores,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-green-500",
                        }))}
                      />
                    </div>
                  )}
                  {reportData.charts.categoryBreakdown && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "توزيع التصنيفات" : "Category Breakdown"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.categoryBreakdown,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
                  {reportData.charts.monthlyTrend && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "الاتجاه الشهري" : "Monthly Trend"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.monthlyTrend,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-purple-500",
                        }))}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
  );
}
