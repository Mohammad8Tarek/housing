import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "../types";

/** ── كارت الترشيح الذكي حسب المستوى ── */
export function RecommendationBanner({
  ar,
  recommendation,
  onSelectBest,
}: {
  ar: boolean;
  recommendation: NonNullable<Recommendation>;
  onSelectBest: () => void;
}) {
  return (
    <div className="p-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
      <div className="flex items-start gap-3.5">
        <div className="p-3 rounded-xl bg-amber-500 text-white shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-sm text-foreground">
              {ar
                ? "أفضل غرفة مقترحة تلقائياً للموظف:"
                : "Best Recommended Room for Employee:"}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm">
              {ar
                ? recommendation.recommendedMap[recommendation.bestRoom.id]
                    ?.badgeLabelAr || "موصى بها"
                : recommendation.recommendedMap[recommendation.bestRoom.id]
                    ?.badgeLabelEn || "Recommended"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? `غرفة رقم ${recommendation.bestRoom.roomNumber} (${recommendation.bestRoom.roomType || "قياسية"} - سعة ${recommendation.bestRoom.capacity} سرير)`
              : `Room ${recommendation.bestRoom.roomNumber} (${recommendation.bestRoom.roomType || "Standard"} - Capacity ${recommendation.bestRoom.capacity} beds)`}
            {ar
              ? recommendation.recommendedMap[recommendation.bestRoom.id]
                  ?.matchReasonAr
                ? ` • ${recommendation.recommendedMap[recommendation.bestRoom.id].matchReasonAr}`
                : ""
              : recommendation.recommendedMap[recommendation.bestRoom.id]
                    ?.matchReasonEn
                ? ` • ${recommendation.recommendedMap[recommendation.bestRoom.id].matchReasonEn}`
                : ""}
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={onSelectBest}
        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-md flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {ar ? "اختيار هذه الغرفة وتسكينه فوراً" : "Select Recommended Room"}
      </Button>
    </div>
  );
}
