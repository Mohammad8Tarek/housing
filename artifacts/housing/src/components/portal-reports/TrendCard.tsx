// Trend over time.
import { TrendingUp } from "lucide-react";
import { BarChart, CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderTrendCard(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.trend && reportData.trend.length > 0 && (
            <CollapsibleSection
              title={ar ? "الاتجاه عبر الزمن" : "Trend Over Time"}
              icon={<TrendingUp className="w-4 h-4" />}
              expanded={expandedSections.trend !== false}
              onToggle={() => toggleSection("trend")}
            >
              <BarChart
                data={reportData.trend.map((t: any) => ({
                  label: t.month,
                  value: t.count || t.total || 0,
                  color: "bg-indigo-500",
                }))}
              />
            </CollapsibleSection>
          )
  );
}
