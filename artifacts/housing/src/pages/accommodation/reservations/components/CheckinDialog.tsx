import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BedDouble, CheckCircle, AlertTriangle } from "lucide-react";
import type { CheckinDialogState, Setter } from "../types";

interface CheckinDialogProps {
  ar: boolean;
  checkinDialog: CheckinDialogState;
  setCheckinDialog: Setter<CheckinDialogState>;
  checkinRoomSearch: string;
  setCheckinRoomSearch: Setter<string>;
  filteredCheckinRooms: any[];
  entireRoomOccupiedSet: Set<number>;
  checkinRecommendations: { recommendedMap: Record<number, any> };
  checkinRoomId: string;
  setCheckinRoomId: Setter<string>;
  buildingMap: Record<string, any>;
  handleCheckin: () => void;
  checkinMutation: { isPending: boolean };
}

export function CheckinDialog({
  ar, checkinDialog, setCheckinDialog, checkinRoomSearch, setCheckinRoomSearch, filteredCheckinRooms,
  entireRoomOccupiedSet, checkinRecommendations, checkinRoomId, setCheckinRoomId, buildingMap,
  handleCheckin, checkinMutation,
}: CheckinDialogProps) {
  return (

      <Dialog open={checkinDialog.open} onOpenChange={(o) => !o && setCheckinDialog({ open: false, id: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "تسكين الحجز" : "Check-In"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {checkinDialog.guestName && <p className="text-sm">{ar ? "الضيف:" : "Guest:"} <span className="font-semibold">{checkinDialog.guestName}</span></p>}
            <Input placeholder={ar ? "بحث عن غرفة..." : "Search room..."} value={checkinRoomSearch} onChange={(e) => setCheckinRoomSearch(e.target.value)} />
            <div className="max-h-52 overflow-y-auto space-y-2">
              {filteredCheckinRooms.map((r: any) => {
                const isEntireReserved = entireRoomOccupiedSet.has(r.id);
                const isFull = (r.currentOccupancy ?? 0) >= (r.capacity ?? 1) || isEntireReserved;
                    const rec = checkinRecommendations.recommendedMap[r.id];
                    const isConflict = rec && rec.score < 0;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={isFull}
                        onClick={() => {
                          if (!isFull) setCheckinRoomId(String(r.id));
                        }}
                        className={`w-full flex items-center justify-between p-3 border-2 rounded-lg text-sm text-left rtl:text-right transition-all ${
                          isFull
                            ? "opacity-50 cursor-not-allowed bg-muted/30 border-border"
                            : checkinRoomId === String(r.id)
                            ? "border-primary bg-primary/5 cursor-pointer"
                            : "border-border hover:border-primary/50 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">
                                {ar ? "غرفة" : "Room"} {r.roomNumber}
                              </p>
                              {rec?.badgeLabelAr && (
                                <Badge className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-[10px] px-1.5 py-0 font-medium">
                                  🤖 {ar ? rec.badgeLabelAr : rec.badgeLabelEn}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {buildingMap[r.buildingId] || "—"} • {r.roomType || "—"} • {r.currentOccupancy ?? 0}/{r.capacity ?? 1}
                            </p>
                            {isConflict && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                {ar ? "تعارض مع سياسات التسكين" : "Policy conflict"}
                              </span>
                            )}
                          </div>
                        </div>
                        {isFull ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                            {ar ? "مكتملة (ساكنة)" : "Full"}
                          </span>
                        ) : checkinRoomId === String(r.id) ? (
                          <CheckCircle className="w-4 h-4 text-primary ml-auto rtl:ml-0 rtl:mr-auto" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCheckinDialog({ open: false, id: null })}>{ar ? "إلغاء" : "Cancel"}</Button>
                  <Button onClick={handleCheckin} disabled={!checkinRoomId || checkinMutation.isPending}>{checkinMutation.isPending ? (ar ? "جاري التسكين..." : "...") : (ar ? "تسكين" : "Check-In")}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
  );
}
