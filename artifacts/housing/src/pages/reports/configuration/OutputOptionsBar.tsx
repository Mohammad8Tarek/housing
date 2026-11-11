// Orientation and export options.
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderOutputOptionsBar(s: ReportConfigurationPageState) {
  const {
    ar,
    orientation,
    setOrientation,
    showStats,
    setShowStats,
    showSignatures,
    setShowSignatures,
    customReportTitleAr,
    setCustomReportTitleAr,
  } = s;
  return (
    <div className="bg-card border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold text-foreground">
            {ar ? "اتجاه التقرير:" : "Orientation:"}
          </Label>
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border">
            <button
              type="button"
              onClick={() => setOrientation("landscape")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                orientation === "landscape"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ar ? "📃 أفقي (Landscape)" : "Landscape"}
            </button>
            <button
              type="button"
              onClick={() => setOrientation("portrait")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                orientation === "portrait"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ar ? "📄 عمودي (Portrait)" : "Portrait"}
            </button>
          </div>
        </div>

        <div className="h-5 w-px bg-border/60 hidden md:block" />

        {/* Show Stats Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-stats"
            checked={showStats}
            onCheckedChange={setShowStats}
          />
          <Label
            htmlFor="toggle-stats"
            className="text-xs font-medium cursor-pointer"
          >
            {ar ? "عرض كروت الإحصائيات (KPIs)" : "Show KPI Cards"}
          </Label>
        </div>

        <div className="h-5 w-px bg-border/60 hidden md:block" />

        {/* Show Signatures Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-sigs"
            checked={showSignatures}
            onCheckedChange={setShowSignatures}
          />
          <Label
            htmlFor="toggle-sigs"
            className="text-xs font-medium cursor-pointer"
          >
            {ar ? "صناديق التوقيع والاعتماد" : "Signature Blocks"}
          </Label>
        </div>
      </div>

      {/* Custom Title Input */}
      <div className="flex items-center gap-2 max-w-sm w-full">
        <Input
          value={customReportTitleAr}
          onChange={(e) => setCustomReportTitleAr(e.target.value)}
          placeholder={
            ar
              ? "عنوان التقرير بالعربية (اختياري)..."
              : "Arabic Report Title (Optional)..."
          }
          className="text-xs h-9"
        />
      </div>
    </div>
  );
}
