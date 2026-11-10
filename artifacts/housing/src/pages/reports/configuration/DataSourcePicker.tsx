// Select the report data source.
import { DATA_SOURCES } from "../config/customReportConfig";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderDataSourcePicker(s: ReportConfigurationPageState) {
  const { ar, selectedSource, handleSourceChange, currentSourceDef } = s;
  return (
<div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
              1
            </span>
            {ar ? "اختيار مصدر البيانات الأساسي (Data Source)" : "Select Report Data Source"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {ar ? `المصدر الحالي: ${currentSourceDef.labelAr}` : `Current: ${currentSourceDef.label}`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {DATA_SOURCES.map((source) => {
            const isSelected = selectedSource === source.id;
            const Icon = source.icon;
            return (
              <button
                key={source.id}
                onClick={() => handleSourceChange(source.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30"
                    : "border-border/70 hover:border-primary/40 bg-card hover:bg-muted/40"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
                <div className={`p-2.5 rounded-xl mb-2 transition-transform group-hover:scale-110 ${source.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold leading-snug line-clamp-1">
                  {ar ? source.labelAr : source.label}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 opacity-70">
                  {source.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
  );
}
