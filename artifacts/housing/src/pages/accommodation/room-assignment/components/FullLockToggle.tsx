import type { Room } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

/** ── خيار Full Lock: قفل الغرفة بالكامل ── */
export function FullLockToggle({
  ar,
  selectedRoom,
  isEntireRoom,
  setIsEntireRoom,
  setSelectedBed,
  canOverrideSingleOccupancy,
}: {
  ar: boolean;
  selectedRoom: Room;
  isEntireRoom: boolean;
  setIsEntireRoom: (v: boolean) => void;
  setSelectedBed: (v: string) => void;
  canOverrideSingleOccupancy: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all shadow-xs ${
        isEntireRoom
          ? "bg-purple-50/90 border-purple-500/80 dark:bg-purple-950/40 dark:border-purple-600 ring-1 ring-purple-500/20"
          : "bg-card border-border hover:border-muted-foreground/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg flex-shrink-0 transition-colors ${
            isEntireRoom ? "bg-purple-600 text-white shadow-xs" : "bg-muted text-muted-foreground"
          }`}>
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground">
                {ar ? "قفل الغرفة بالكامل (Full Lock / غرفة خاصة لموظف واحد)" : "Full Lock / Private Room (Single Resident)"}
              </span>
              {isEntireRoom && (
                <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-extrabold px-2 py-0.5 shadow-2xs">
                  {ar ? "🔒 Full Lock مفعل" : "🔒 Full Lock Active"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedRoom.currentOccupancy > 0
                ? ar
                  ? "⚠️ لا يمكن عمل Full Lock لوجود نزلاء حاليين بالغرفة. الغرفة متاحة فقط للتسكين المشترك على الأسِرّة الشاغرة."
                  : "Cannot apply Full Lock: room already has active occupants."
                : isEntireRoom
                  ? ar
                    ? `تم حجز كافة أسِرّة الغرفة (${selectedRoom.capacity} سرير) بالكامل لهذا الموظف. لن تظهر الغرفة كشاغرة ولن يُسمح بتسكين أي شخص آخر عليها نهائياً.`
                    : `All ${selectedRoom.capacity} beds are locked for this resident. No one else can be assigned.`
                  : ar
                    ? "هل تريد قفل هذه الغرفة بالكامل لهذا الموظف كغرفة خاصة مستقلة؟ (يمنع تسكين أي نزيل آخر معه في نفس الغرفة)."
                    : "Check this to lock the entire room exclusively for this employee (prevents sharing)."}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-shrink-0 pt-0.5">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="entire-room-toggle"
              checked={isEntireRoom}
              disabled={selectedRoom.currentOccupancy > 0 || (!canOverrideSingleOccupancy && selectedRoom.capacity > 1)}
              onChange={(e) => {
                if (!canOverrideSingleOccupancy && selectedRoom.capacity > 1) {
                  toast.error(
                    ar
                      ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية (override_single_occupancy)."
                      : "Reserving an entire multi-bed room for a single person requires administrative permission."
                  );
                  return;
                }
                const checked = e.target.checked;
                setIsEntireRoom(checked);
                if (checked) {
                  setSelectedBed("1");
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
