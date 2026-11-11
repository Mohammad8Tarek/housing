import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Building2,
  Search,
  BedDouble,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";
import { EmpAvatar } from "./EmpAvatar";

export type TransferDialogState = {
  open: boolean;
  id: number | null;
  emp?: any;
  sourcePropertyId?: number;
};

type Props = {
  ar: boolean;
  dialog: TransferDialogState;
  setDialog: (v: TransferDialogState) => void;
  activePropertyId: any;
  canCrossProperty: boolean;
  contextProperties: any[];
  transferPropertyId: string;
  setTransferPropertyId: (v: string) => void;
  transferRoomId: string;
  setTransferRoomId: (v: string) => void;
  selectedTransferBed: string;
  setSelectedTransferBed: (v: string) => void;
  roomSearch: string;
  setRoomSearch: (v: string) => void;
  transferReason: string;
  setTransferReason: (v: string) => void;
  transferArchiveSource: boolean;
  setTransferArchiveSource: (v: boolean) => void;
  filteredTransferRooms: any[];
  targetBuildingMap: Record<string, any>;
  transferRecommendations: { recommendedMap: Record<number, any> };
  bedOptions: number[];
  targetOccupiedBeds: Set<number>;
  bedOccupantsMap: Map<number, { name: string; isOnVacation?: boolean }>;
  isPending: boolean;
  onConfirm: () => void;
};

export function TransferDialog({
  ar,
  dialog: transferDialog,
  setDialog: setTransferDialog,
  activePropertyId,
  canCrossProperty,
  contextProperties,
  transferPropertyId,
  setTransferPropertyId,
  transferRoomId,
  setTransferRoomId,
  selectedTransferBed,
  setSelectedTransferBed,
  roomSearch,
  setRoomSearch,
  transferReason,
  setTransferReason,
  transferArchiveSource,
  setTransferArchiveSource,
  filteredTransferRooms,
  targetBuildingMap,
  transferRecommendations,
  bedOptions,
  targetOccupiedBeds,
  bedOccupantsMap,
  isPending,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={transferDialog.open}
      onOpenChange={(open) => {
        if (!open) {
          setTransferDialog({ open: false, id: null });
          setTransferRoomId("");
          setSelectedTransferBed("");
          setRoomSearch("");
          setTransferPropertyId("");
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "نقل لغرفة جديدة" : "Room Move"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            {ar ? "نقل لغرفة جديدة" : "Room Move"}
          </DialogTitle>
        </DialogHeader>
        {transferDialog.emp && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 -mt-2">
            <EmpAvatar emp={transferDialog.emp} />
            <div>
              <p className="font-semibold text-sm">
                {transferDialog.emp.firstName} {transferDialog.emp.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {transferDialog.emp.profileId}
              </p>
            </div>
          </div>
        )}
        <div className="space-y-4 pt-1">
          {/* Cross-property transfer for super_admin or users with accommodation.transfer */}
          {canCrossProperty && contextProperties.length > 1 && (
            <div className="space-y-1.5">
              <Label>{ar ? "الفرع المستهدف" : "Target Property"}</Label>
              <Select
                value={transferPropertyId || String(activePropertyId ?? "")}
                onValueChange={(v) => {
                  setTransferPropertyId(v);
                  setTransferRoomId("");
                  setRoomSearch("");
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue
                    placeholder={ar ? "اختر الفرع..." : "Select property..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  {contextProperties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {p.name}
                        {p.id === activePropertyId && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1 ml-1"
                          >
                            {ar ? "حالي" : "current"}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {ar ? "الغرفة الجديدة" : "New Room"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder={ar ? "بحث عن غرفة..." : "Search room..."}
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
              />
            </div>
            <div className="border rounded-lg max-h-52 overflow-y-auto">
              {filteredTransferRooms.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  {ar ? "لا توجد غرف متاحة" : "No available rooms"}
                </p>
              ) : (
                filteredTransferRooms.map((r: any) => {
                  const building = targetBuildingMap[r.buildingId];
                  const isSelected = transferRoomId === String(r.id);
                  const available =
                    (r.capacity ?? 1) - (r.currentOccupancy ?? 0);
                  const rec = transferRecommendations.recommendedMap[r.id];
                  const isConflict = rec && rec.score < 0;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setTransferRoomId(String(r.id));
                        setSelectedTransferBed("");
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between border-b last:border-0 transition-colors ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                    >
                      <div className="flex flex-col text-left gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-semibold">
                            {r.roomNumber}
                          </span>
                          {building && (
                            <span className="text-xs text-muted-foreground">
                              {building}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground capitalize">
                            {r.roomType}
                          </span>
                          {rec?.badgeLabelAr && (
                            <Badge className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-[10px] px-1.5 py-0 font-medium">
                              🤖 {ar ? rec.badgeLabelAr : rec.badgeLabelEn}
                            </Badge>
                          )}
                        </div>
                        {isConflict && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {ar
                              ? "تحذير: مخالفة سياسة التسكين"
                              : "Warning: Conflicts with policy"}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs ml-2 shrink-0"
                      >
                        <BedDouble className="w-3 h-3 mr-1" />
                        {available}/{r.capacity}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {transferRoomId && bedOptions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-muted-foreground" />
                  {ar ? "السرير في الغرفة الجديدة" : "Bed in New Room"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.max(0, bedOptions.length - targetOccupiedBeds.size)} /{" "}
                  {bedOptions.length} {ar ? "متاح" : "available"}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {bedOptions.map((bed) => {
                  const isTaken = targetOccupiedBeds.has(bed);
                  const isSelected = selectedTransferBed === String(bed);
                  const occupantInfo = bedOccupantsMap.get(bed);
                  return (
                    <button
                      key={bed}
                      type="button"
                      onClick={() => {
                        if (!isTaken) setSelectedTransferBed(String(bed));
                      }}
                      disabled={isTaken}
                      aria-disabled={isTaken}
                      title={
                        isTaken
                          ? occupantInfo?.name
                            ? `${ar ? "مشغول بواسطة:" : "Occupied by:"} ${occupantInfo.name}`
                            : ar
                              ? "هذا السرير مشغول"
                              : "Bed already occupied"
                          : undefined
                      }
                      className={`relative flex flex-col items-center justify-center min-w-[90px] px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        isTaken
                          ? "bg-muted/40 border-red-200 dark:border-red-900/40 text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none select-none"
                          : isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20"
                            : "bg-card hover:bg-muted border-border cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{ar ? `سرير ${bed}` : `Bed ${bed}`}</span>
                        {isTaken && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-300 font-bold"
                          >
                            {occupantInfo?.isOnVacation
                              ? ar
                                ? "إجازة"
                                : "Vacation"
                              : ar
                                ? "مشغول"
                                : "Occupied"}
                          </Badge>
                        )}
                      </div>
                      {isTaken && occupantInfo?.name && (
                        <span className="text-[10px] text-muted-foreground/80 truncate max-w-[100px] mt-0.5 font-normal">
                          {occupantInfo.name}
                        </span>
                      )}
                      {isTaken && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-xs">
                          <X className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedTransferBed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  {ar
                    ? `تم اختيار سرير ${selectedTransferBed}`
                    : `Bed ${selectedTransferBed} selected`}
                </p>
              )}
            </div>
          )}

          {/* Cross-property transfer profile fate choice */}
          {transferPropertyId &&
            String(transferPropertyId) !== String(activePropertyId) && (
              <div className="p-3 rounded-xl border-2 border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold">
                    {ar
                      ? "نقل موظف إلى فرع/فندق آخر (Cross-Property Transfer)"
                      : "Cross-Property Transfer"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {ar
                    ? "سيتم تسجيل خروج الموظف من غرفته الحالية وتحرير سريره مع حفظ كافة سجلات الغرف التاريخية 100%."
                    : "Resident will be checked out and their bed released, with 100% room logs preserved."}
                </p>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold text-foreground">
                    {ar
                      ? "ماذا تريد أن تفعل بملف الموظف في هذا الفندق؟"
                      : "What should happen to the profile in this hotel?"}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferArchiveSource(true)}
                      className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer ${
                        transferArchiveSource
                          ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-2xs"
                          : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {ar
                            ? "1. نقله وحذفه من هنا"
                            : "1. Transfer & Archive Here"}
                        </span>
                        {transferArchiveSource && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ar
                          ? "أرشفة الملف هنا لعدم التكرار، مع بقاء كل لوج الغرف 100%."
                          : "Archive profile here to avoid duplicates, keeping all room logs."}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferArchiveSource(false)}
                      className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer ${
                        !transferArchiveSource
                          ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-2xs"
                          : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {ar
                            ? "2. نقله وتسيب البروفايل هنا"
                            : "2. Keep Profile Active Here"}
                        </span>
                        {!transferArchiveSource && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ar
                          ? "إبقاء الملف متاحاً ونشطاً في هذا الفندق أيضاً (انتداب / فرعين)."
                          : "Keep profile active in this hotel too (secondment / dual work)."}
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

          <div className="space-y-1.5">
            <Label>{ar ? "سبب النقل" : "Transfer Reason"}</Label>
            <Textarea
              placeholder={ar ? "سبب النقل..." : "Reason for transfer..."}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setTransferDialog({ open: false, id: null })}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => onConfirm()}
              disabled={isPending || !transferRoomId}
            >
              {isPending
                ? ar
                  ? "جاري النقل..."
                  : "Moving..."
                : ar
                  ? "تأكيد النقل"
                  : "Confirm Move"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
