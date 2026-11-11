// Summary KPI cards per report type.
import {
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  Star,
  Target,
  Calendar,
} from "lucide-react";
import { KPICard } from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderKpiCards(s: PortalReportsState, v: PortalReportsView) {
  const { ar, reportConfig, reportData } = s;
  const { summary } = v;
  return (
    reportData && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportConfig.type === "evaluations" && (
          <>
            <KPICard
              icon={Star}
              label={ar ? "متوسط التقييم" : "Avg Rating"}
              value={summary.globalAvgRating ?? 0}
              sub={`/ 5.0`}
              color="text-amber-500"
            />
            <KPICard
              icon={FileText}
              label={ar ? "إجمالي الردود" : "Total Responses"}
              value={summary.totalResponses ?? 0}
              sub={
                ar
                  ? `${summary.uniqueRespondents ?? 0} موظف`
                  : `${summary.uniqueRespondents ?? 0} profiles`
              }
              color="text-blue-500"
            />
            <KPICard
              icon={Users}
              label={ar ? "نسبة الاستجابة" : "Response Rate"}
              value={`${summary.responseRate ?? 0}%`}
              sub={
                ar
                  ? `من ${summary.totalProfiles ?? 0} موظف`
                  : `of ${summary.totalProfiles ?? 0} profiles`
              }
              color="text-green-500"
            />
            <KPICard
              icon={BarChart3}
              label={ar ? "عدد الاستبيانات" : "Templates"}
              value={summary.totalTemplates ?? 0}
              color="text-purple-500"
            />
          </>
        )}
        {reportConfig.type === "activities" && (
          <>
            <KPICard
              icon={Target}
              label={ar ? "إجمالي الفعاليات" : "Total Activities"}
              value={summary.totalActivities ?? 0}
              color="text-blue-500"
            />
            <KPICard
              icon={Users}
              label={ar ? "المسجلون" : "Registered"}
              value={summary.totalJoined ?? 0}
              sub={`${summary.participationRate ?? 0}% ${ar ? "مشاركة" : "participation"}`}
              color="text-green-500"
            />
            <KPICard
              icon={Star}
              label={ar ? "الحاضرون" : "Attended"}
              value={summary.totalAttended ?? 0}
              sub={`${summary.overallAttendanceRate ?? 0}% ${ar ? "حضور" : "attendance"}`}
              color="text-amber-500"
            />
            <KPICard
              icon={Calendar}
              label={ar ? "المهتمون" : "Interested"}
              value={summary.totalInterested ?? 0}
              color="text-purple-500"
            />
          </>
        )}
        {reportConfig.type === "engagement" && (
          <>
            <KPICard
              icon={TrendingUp}
              label={ar ? "نسبة المشاركة" : "Overall Score"}
              value={`${summary.overallScore ?? 0}%`}
              color="text-green-500"
            />
            <KPICard
              icon={Users}
              label={ar ? "الموظفون النشطون" : "Engaged"}
              value={summary.engagedProfiles ?? 0}
              sub={
                ar
                  ? `من ${summary.totalProfiles ?? 0}`
                  : `of ${summary.totalProfiles ?? 0}`
              }
              color="text-blue-500"
            />
            <KPICard
              icon={Star}
              label={ar ? "نسبة التقييم" : "Evaluation Rate"}
              value={`${summary.evaluationRate ?? 0}%`}
              color="text-amber-500"
            />
            <KPICard
              icon={Target}
              label={ar ? "نسبة الحضور" : "Attendance Rate"}
              value={`${summary.attendanceRate ?? 0}%`}
              color="text-purple-500"
            />
          </>
        )}
        {reportConfig.type === "custom" && (
          <>
            <KPICard
              icon={BarChart3}
              label={ar ? "الأقسام" : "Modules"}
              value={summary.modulesGenerated ?? 0}
              color="text-blue-500"
            />
            <KPICard
              icon={FileText}
              label={ar ? "النوع" : "Modules"}
              value={summary.modules ?? ""}
              color="text-green-500"
            />
          </>
        )}
      </div>
    )
  );
}
