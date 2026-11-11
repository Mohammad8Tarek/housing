// Report type, period and filters; generate/export actions.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, PlusCircle, Loader } from "lucide-react";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderReportConfigCard(
  s: PortalReportsState,
  v: PortalReportsView,
) {
  const {
    ar,
    reportConfig,
    setReportConfig,
    quickPeriod,
    isGenerating,
    departments,
    applyDatePreset,
    handleExport,
    reportTypes,
    datePresets,
  } = s;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="w-5 h-5" />
          {ar ? "إعداد التقرير" : "Report Configuration"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{ar ? "نوع التقرير" : "Report Type"}</Label>
            <Select
              value={reportConfig.type}
              onValueChange={(v) =>
                setReportConfig({ ...reportConfig, type: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{ar ? "القسم" : "Department"}</Label>
            <Select
              value={reportConfig.department}
              onValueChange={(v) =>
                setReportConfig({ ...reportConfig, department: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {ar ? "جميع الأقسام" : "All Departments"}
                </SelectItem>
                {departments.map((d: string) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{ar ? "فترة سريعة" : "Quick Period"}</Label>
            <Select value={quickPeriod} onValueChange={applyDatePreset}>
              <SelectTrigger>
                <SelectValue
                  placeholder={ar ? "اختر فترة..." : "Select period..."}
                />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{ar ? "من التاريخ" : "From Date"}</Label>
            <DateInput
              value={reportConfig.dateFrom}
              onChange={(iso) =>
                setReportConfig({ ...reportConfig, dateFrom: iso })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{ar ? "إلى التاريخ" : "To Date"}</Label>
            <DateInput
              value={reportConfig.dateTo}
              onChange={(iso) =>
                setReportConfig({ ...reportConfig, dateTo: iso })
              }
            />
          </div>

          {reportConfig.type === "custom" && (
            <div className="space-y-2">
              <Label>{ar ? "الأقسام" : "Modules"}</Label>
              <div className="flex gap-2 flex-wrap">
                {["evaluations", "activities", "engagement"].map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={reportConfig.modules.includes(m)}
                      onChange={(e) => {
                        const modules = e.target.checked
                          ? [...reportConfig.modules, m]
                          : reportConfig.modules.filter((x) => x !== m);
                        setReportConfig({ ...reportConfig, modules });
                      }}
                      className="w-3.5 h-3.5 rounded"
                    />
                    {m === "evaluations"
                      ? ar
                        ? "تقييمات"
                        : "Evaluations"
                      : m === "activities"
                        ? ar
                          ? "فعاليات"
                          : "Activities"
                        : ar
                          ? "مشاركة"
                          : "Engagement"}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            className="gap-2"
            onClick={() => handleExport("pdf")}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {ar ? "تصدير PDF" : "Export PDF"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleExport("excel")}
            disabled={isGenerating}
          >
            <Download className="w-4 h-4" />
            {ar ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
