// Provider cards: custom gateway / Meta Cloud / Baileys QR.
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Smartphone, Check, Sliders } from "lucide-react";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderProviderPicker(s: WhatsAppSettingsSectionState) {
  const { ar, provider, setProvider, handleSaveConfig } = s;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Option 1: Custom / Any WhatsApp Gateway */}
      <button
        type="button"
        onClick={() => {
          setProvider("custom_gateway");
          handleSaveConfig("custom_gateway");
        }}
        className={`p-3.5 rounded-2xl border-2 text-start transition-all relative overflow-hidden flex flex-col justify-between gap-3 ${
          provider === "custom_gateway"
            ? "border-indigo-500 bg-indigo-500/5 shadow-md ring-2 ring-indigo-500/20"
            : "border-border/70 hover:border-indigo-500/40 bg-card hover:bg-muted/30"
        }`}
      >
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                <span>
                  {ar ? "بوابة مخصصة (أي API)" : "Custom Gateway (Any API)"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {ar
                  ? "Wassenger, Green-API, Chat-API أو أي برودكت"
                  : "Any external WhatsApp API"}
              </div>
            </div>
          </div>
          {provider === "custom_gateway" && (
            <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px]"
          >
            🌐 {ar ? "مرن وشامل" : "Universal"}
          </Badge>
        </div>
      </button>

      {/* Option 3: Meta Cloud API */}
      <button
        type="button"
        onClick={() => {
          setProvider("meta_cloud");
          handleSaveConfig("meta_cloud");
        }}
        className={`p-3.5 rounded-2xl border-2 text-start transition-all relative overflow-hidden flex flex-col justify-between gap-3 ${
          provider === "meta_cloud"
            ? "border-emerald-500 bg-emerald-500/5 shadow-md ring-2 ring-emerald-500/20"
            : "border-border/70 hover:border-emerald-500/40 bg-card hover:bg-muted/30"
        }`}
      >
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                <span>
                  {ar ? "Meta Cloud (الرسمي)" : "Meta Cloud (Official)"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {ar ? "الربط الرسمي من شركة Meta" : "Direct official Meta API"}
              </div>
            </div>
          </div>
          {provider === "meta_cloud" && (
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
          >
            🛡️ {ar ? "أمان 100%" : "Zero-Ban"}
          </Badge>
        </div>
      </button>

      {/* Option 4: Baileys Direct Phone */}
      <button
        type="button"
        onClick={() => {
          setProvider("baileys");
          handleSaveConfig("baileys");
        }}
        className={`p-3.5 rounded-2xl border-2 text-start transition-all relative overflow-hidden flex flex-col justify-between gap-3 ${
          provider === "baileys"
            ? "border-[#00a884] bg-[#00a884]/5 shadow-md ring-2 ring-[#00a884]/20"
            : "border-border/70 hover:border-[#00a884]/40 bg-card hover:bg-muted/30"
        }`}
      >
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-xs shrink-0"
              style={{ backgroundColor: "#00a884" }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                <span>{ar ? "مسح QR (Baileys)" : "Direct QR (Baileys)"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {ar ? "مسح رمز QR من هاتف السكن" : "Scan QR code directly"}
              </div>
            </div>
          </div>
          {provider === "baileys" && (
            <div className="w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px]"
          >
            📱 {ar ? "تطبيق الهاتف" : "Physical Device"}
          </Badge>
        </div>
      </button>
    </div>
  );
}
