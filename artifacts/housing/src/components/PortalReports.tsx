import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  usePortalReportsState,
  buildPortalReportsView,
} from "./portal-reports/usePortalReportsState";
import { renderKpiCards } from "./portal-reports/KpiCards";
import { renderReportConfigCard } from "./portal-reports/ReportConfigCard";
import { renderChartsCard } from "./portal-reports/ChartsCard";
import { renderDepartmentRanking } from "./portal-reports/DepartmentRanking";
import { renderTopRatedItems } from "./portal-reports/TopRatedItems";
import { renderLowestRatedItems } from "./portal-reports/LowestRatedItems";
import { renderTopActivities } from "./portal-reports/TopActivities";
import { renderEmptyActivities } from "./portal-reports/EmptyActivities";
import { renderMostActiveProfiles } from "./portal-reports/MostActiveProfiles";
import { renderNonEngagedProfiles } from "./portal-reports/NonEngagedProfiles";
import { renderEvaluationSections } from "./portal-reports/EvaluationSections";
import { renderTrendCard } from "./portal-reports/TrendCard";
import { renderTemplatesBreakdown } from "./portal-reports/TemplatesBreakdown";
import { renderActivitiesList } from "./portal-reports/ActivitiesList";

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PortalReports(props: { defaultType?: string }) {
  const s = usePortalReportsState(props);
  const { ar, reportData, isLoading, reportsError, refetch } = s;

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  if (reportsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{ar ? "التقارير" : "Reports"}</h2>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-destructive">
              {ar ? "فشل تحميل التقارير" : "Failed to load reports"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              {ar ? "إعادة المحاولة" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const v = buildPortalReportsView(s);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            {ar ? "التقارير" : "Reports"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "إنشاء وتصدير التقارير التحليلية"
              : "Generate and export analytics reports"}
          </p>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      {renderKpiCards(s, v)}

      {/* ═══ REPORT CONFIG ═══ */}
      {renderReportConfigCard(s, v)}

      {/* ═══ REPORT DATA ═══ */}
      {reportData && (
        <div className="space-y-4">
          {/* Charts */}
          {renderChartsCard(s, v, reportData)}

          {/* Department Ranking */}
          {renderDepartmentRanking(s, v, reportData)}

          {/* Top Items */}
          {renderTopRatedItems(s, v, reportData)}

          {/* Lowest Items */}
          {renderLowestRatedItems(s, v, reportData)}

          {/* Top Activities */}
          {renderTopActivities(s, v, reportData)}

          {/* Empty Activities */}
          {renderEmptyActivities(s, v, reportData)}

          {/* Most Active Profiles */}
          {renderMostActiveProfiles(s, v, reportData)}

          {/* Non-Engaged */}
          {renderNonEngagedProfiles(s, v, reportData)}

          {/* Custom Report Sections */}
          {renderEvaluationSections(s, v, reportData)}

          {/* Trend */}
          {renderTrendCard(s, v, reportData)}

          {/* Templates/Activities detail */}
          {renderTemplatesBreakdown(s, v, reportData)}

          {renderActivitiesList(s, v, reportData)}
        </div>
      )}
    </div>
  );
}
