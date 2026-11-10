// Per-template breakdown.
import { FileText } from "lucide-react";
import { BarChart, StarBar, CollapsibleSection } from "./PortalReports.constants";
import type { PortalReportsState, PortalReportsView } from "./usePortalReportsState";

export function renderTemplatesBreakdown(s: PortalReportsState, v: PortalReportsView, reportData: NonNullable<PortalReportsState["reportData"]>) {
  const { ar, expandedSections, toggleSection } = s;
  return (
reportData.templates &&
            reportData.templates.map((tpl: any) => (
              <CollapsibleSection
                key={tpl.templateId}
                title={
                  ar ? tpl.titleAr || tpl.titleEn : tpl.titleEn || tpl.titleAr
                }
                icon={<FileText className="w-4 h-4" />}
                expanded={expandedSections[`tpl_${tpl.templateId}`] !== false}
                onToggle={() => toggleSection(`tpl_${tpl.templateId}`)}
              >
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{tpl.totalResponses}</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "ردود" : "Responses"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{tpl.responseRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "نسبة الاستجابة" : "Response Rate"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold text-amber-600">
                      {tpl.overallAvgRating}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "متوسط التقييم" : "Avg Rating"}
                    </p>
                  </div>
                </div>
                {tpl.starDistribution && (
                  <StarBar distribution={tpl.starDistribution} />
                )}
                {tpl.textResponses && tpl.textResponses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "ردود نصية" : "Text Responses"}
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {tpl.textResponses.map((tr: any, i: number) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-muted/20 text-xs"
                        >
                          <span className="font-medium text-muted-foreground">
                            {ar ? tr.question : tr.question}:
                          </span>{" "}
                          <span>{tr.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tpl.departmentBreakdown &&
                  tpl.departmentBreakdown.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">
                        {ar ? "تحليل الأقسام" : "Department Breakdown"}
                      </p>
                      <BarChart
                        data={tpl.departmentBreakdown.map((d: any) => ({
                          label: d.department,
                          value: d.responseCount,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
              </CollapsibleSection>
            ))
  );
}
