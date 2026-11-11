import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { type ProfileResult } from "../../shared/profile-search";
import type { Setter } from "../types";

interface CrossPropertyConfirmDialogProps {
  ar: boolean;
  crossPropertyModalOpen: boolean;
  setCrossPropertyModalOpen: Setter<boolean>;
  selectedProfile: ProfileResult | null;
  activeProp: any;
  archiveSourceProfile: boolean;
  setArchiveSourceProfile: Setter<boolean>;
  setTransferType: Setter<"PERMANENT" | "TASK_FORCE">;
  executeSubmission: (archiveOverride?: boolean) => Promise<void>;
  createAssignmentMutation: { isPending: boolean };
  createReservationMutation: { isPending: boolean };
}

export function CrossPropertyConfirmDialog({
  ar,
  crossPropertyModalOpen,
  setCrossPropertyModalOpen,
  selectedProfile,
  activeProp,
  archiveSourceProfile,
  setArchiveSourceProfile,
  setTransferType,
  executeSubmission,
  createAssignmentMutation,
  createReservationMutation,
}: CrossPropertyConfirmDialogProps) {
  return (
    <Dialog
      open={crossPropertyModalOpen}
      onOpenChange={setCrossPropertyModalOpen}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <ArrowRightLeft className="w-5 h-5 text-amber-600" />
            <span>
              {ar
                ? "تأكيد نقل وتسكين موظف من فندق آخر"
                : "Confirm Cross-Property Assignment"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {selectedProfile && (
          <div className="space-y-4 pt-1">
            {/* ملخص الموظف والفرعين */}
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  {selectedProfile.firstName} {selectedProfile.lastName}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  #{selectedProfile.profileId}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground">
                  {selectedProfile.jobTitle ||
                    selectedProfile.department ||
                    (ar ? "موظف" : "Employee")}
                </span>
                <span>•</span>
                <span>
                  {ar ? "الفندق المسجل به حالياً:" : "Current Hotel:"}{" "}
                  <strong className="text-foreground">
                    {selectedProfile.propertyName}
                  </strong>
                </span>
                <span>➔</span>
                <span>
                  {ar ? "فندق التسكين الجديد:" : "Target Hotel:"}{" "}
                  <strong className="text-primary">{activeProp?.name}</strong>
                </span>
              </div>
            </div>

            {/* تنبيه إذا كان ساكناً في الفندق القديم */}
            {selectedProfile.accommodationRoom && (
              <div className="p-3 rounded-lg border-2 border-amber-500/60 bg-amber-100/90 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 flex items-start gap-2.5 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold">
                    {ar
                      ? `تنبيه: الموظف ساكن حالياً في ${selectedProfile.propertyName} - غرفة رقم ${selectedProfile.accommodationRoom}!`
                      : `Notice: Resident is currently housed in ${selectedProfile.propertyName} - Room ${selectedProfile.accommodationRoom}!`}
                  </p>
                  <p className="text-muted-foreground dark:text-amber-200/90 leading-relaxed">
                    {ar
                      ? "⚡ سيقوم النظام تلقائياً بإنهاء إقامته السابقة (Check-out) وتحرير السرير هناك فور تأكيد التسكين، مع الحفاظ الكامل على كافة سجلات الغرف واللوج التاريخي 100% دون أي حذف."
                      : "System will automatically check out previous accommodation and release bed upon assignment, preserving 100% of historical room logs."}
                  </p>
                </div>
              </div>
            )}

            {/* السؤال الصريح: ماذا تريد أن تفعل بملف الموظف في الفندق القديم؟ */}
            <div className="space-y-2 pt-1">
              <label className="text-sm font-bold text-foreground block">
                {ar
                  ? `سؤال: ماذا تريد أن تفعل بملف الموظف في الفندق القديم (${selectedProfile.propertyName})؟`
                  : `What should happen to the profile in (${selectedProfile.propertyName})?`}
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setArchiveSourceProfile(true);
                    setTransferType("PERMANENT");
                  }}
                  className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer relative ${
                    archiveSourceProfile
                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                      : "bg-background border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          archiveSourceProfile
                            ? "border-primary bg-primary text-white"
                            : "border-muted-foreground"
                        }`}
                      >
                        {archiveSourceProfile && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {ar
                          ? "1. نقله وحذفه من قائمة الفندق القديم (أرشفة لعدم التكرار)"
                          : "1. Transfer & Archive from Old Hotel"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium bg-muted/60 text-muted-foreground"
                    >
                      {ar ? "الموصى به" : "Recommended"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 ms-6 leading-relaxed">
                    {ar
                      ? "يتم نقل الموظف لهذا الفندق وأرشفة ملفه القديم لعدم تكرار اسمه في القوائم النشطة، مع بقاء كل سجلات الإقامة ولوج الغرف القديمة 100% دون مساس."
                      : "Permanently move employee, archiving old profile while fully preserving past room stay logs."}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setArchiveSourceProfile(false);
                    setTransferType("TASK_FORCE");
                  }}
                  className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer relative ${
                    !archiveSourceProfile
                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                      : "bg-background border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !archiveSourceProfile
                            ? "border-primary bg-primary text-white"
                            : "border-muted-foreground"
                        }`}
                      >
                        {!archiveSourceProfile && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {ar
                          ? "2. نقله وتسيب البروفايل موجود ونشط في الفندق القديم أيضاً"
                          : "2. Keep Profile Active in Both Hotels"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium bg-muted/60 text-muted-foreground"
                    >
                      {ar ? "انتداب / فرعين" : "Secondment / Dual"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 ms-6 leading-relaxed">
                    {ar
                      ? "تسكين الموظف هنا مع إبقاء ملفه الشخصي متاحاً ونشطاً في الفندق القديم أيضاً (مناسب للانتداب أو العمل المشترك بالفرعين)."
                      : "Assign resident here while keeping profile active in the source property (for Task Force / dual work)."}
                  </p>
                </button>
              </div>
            </div>

            {/* أزرار النافذة */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCrossPropertyModalOpen(false)}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={() => executeSubmission()}
                disabled={
                  createAssignmentMutation.isPending ||
                  createReservationMutation.isPending
                }
                className="gap-2 bg-primary hover:bg-primary/90 font-bold"
              >
                {(createAssignmentMutation.isPending ||
                  createReservationMutation.isPending) && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {ar
                    ? "تأكيد التسكين والنقل الآن"
                    : "Confirm Assignment & Transfer"}
                </span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
