import type { Room } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import {
  BedDouble,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { OccupantInfo } from "../types";

/** ── قسم اختيار السرير: هتسكن في أنهي سرير؟ ── */
export function BedSelector({
  ar,
  selectedRoom,
  bedOptions,
  selectedBed,
  setSelectedBed,
  isEntireRoom,
  occupiedBeds,
  selectedRoomBedMap,
}: {
  ar: boolean;
  selectedRoom: Room;
  bedOptions: number[];
  selectedBed: string;
  setSelectedBed: (v: string) => void;
  isEntireRoom: boolean;
  occupiedBeds: Set<number>;
  selectedRoomBedMap: Map<number, OccupantInfo>;
}) {
  return (
    <div className="space-y-2 p-4 rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-sm font-bold flex items-center gap-2 text-foreground">
          <BedDouble className="w-4 h-4 text-primary" />
          <span>
            {ar
              ? "هتسكن في أنهي سرير؟ (اختر رقم السرير)"
              : "Where will the employee sleep? (Select Bed)"}
          </span>
          <span className="text-red-500 font-bold">*</span>
        </label>
        {isEntireRoom ? (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 text-xs"
          >
            {ar
              ? "تم قفل كل أسِرّة الغرفة (Full Lock)"
              : "All Beds Locked (Full Lock)"}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {selectedRoom.capacity === 1
              ? ar
                ? "غرفة بسرير فردي واحد"
                : "Single Bed Room"
              : ar
                ? `الغرفة سعة ${selectedRoom.capacity} أسِرّة`
                : `Capacity: ${selectedRoom.capacity} beds`}
          </span>
        )}
      </div>

      {/* أزرار الأسرة */}
      <div className="flex gap-2.5 flex-wrap pt-1">
        {bedOptions.map((bed) => {
          const isTaken = occupiedBeds.has(bed);
          const isSelected = selectedBed === String(bed);
          const occInfo = selectedRoomBedMap.get(bed);

          if (isEntireRoom) {
            const isBed1 = bed === 1;
            return (
              <div
                key={bed}
                className={`relative px-4 py-2.5 rounded-lg border text-xs font-bold transition-all inline-flex items-center gap-2 ${
                  isBed1
                    ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                    : "bg-purple-50/70 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300 opacity-90 select-none"
                }`}
              >
                {isBed1 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>
                      {ar
                        ? `سرير ${bed} (السرير الرئيسي)`
                        : `Bed ${bed} (Primary)`}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>
                      {ar
                        ? `سرير ${bed} (مقفل Full Lock)`
                        : `Bed ${bed} (Locked)`}
                    </span>
                  </>
                )}
              </div>
            );
          }

          return (
            <button
              key={bed}
              type="button"
              onClick={() => {
                if (isTaken) return;
                setSelectedBed(String(bed));
              }}
              disabled={isTaken}
              title={
                isTaken
                  ? ar
                    ? `سرير ${bed} مشغول بالنزيل: ${occInfo?.residentName || ""}`
                    : `Bed ${bed} occupied by: ${occInfo?.residentName || ""}`
                  : undefined
              }
              className={`relative px-4 py-2.5 rounded-lg border text-xs font-bold transition-all inline-flex items-center gap-2 ${
                isTaken
                  ? "bg-destructive/10 border-destructive/30 text-destructive cursor-not-allowed opacity-75 select-none"
                  : isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20"
                    : "bg-background hover:bg-muted/60 border-border cursor-pointer text-foreground hover:border-primary/50"
              }`}
            >
              {isTaken ? (
                <Lock className="w-3.5 h-3.5 text-destructive shrink-0" />
              ) : isSelected ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground shrink-0" />
              ) : null}
              <span>{ar ? `سرير ${bed}` : `Bed ${bed}`}</span>
              {isTaken ? (
                <span className="text-[10px] font-normal opacity-90 truncate max-w-[130px]">
                  ({occInfo?.residentName || (ar ? "مشغول" : "Occupied")})
                </span>
              ) : (
                <span
                  className={`text-[10px] font-normal ${isSelected ? "text-primary-foreground/90" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  ({ar ? "متاح" : "Free"})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* نص توضيحي لحالة الاختيار */}
      {isEntireRoom ? (
        <p className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1.5 pt-1">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ar
              ? "تم تفعيل Full Lock: تم تخصيص السرير 1 للموظف وقفل باقي أسرة الغرفة بالكامل."
              : "Full Lock active: Bed 1 assigned and all other beds locked for this occupant."}
          </span>
        </p>
      ) : selectedBed ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ar
              ? `تم اختيار السرير رقم ${selectedBed} للتسكين.`
              : `Bed ${selectedBed} selected for assignment.`}
          </span>
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ar
              ? "يرجى النقر على رقم السرير المطلوب من الأزرار أعلاه لتسكين الموظف عليه."
              : "Please click on the desired bed button above to assign the employee."}
          </span>
        </p>
      )}
    </div>
  );
}
