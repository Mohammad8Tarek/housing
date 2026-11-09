import type { Property } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react";
import type { ProfileResult } from "../../shared/profile-search";

/** ── كارت التسكين العابر للفنادق (Cross-Property Assignment) ── */
export function CrossPropertyTransferCard({
  ar,
  selectedProfile,
  targetProp,
  archiveSourceProfile,
  setArchiveSourceProfile,
  setTransferType,
}: {
  ar: boolean;
  selectedProfile: ProfileResult;
  targetProp: Property | undefined;
  archiveSourceProfile: boolean;
  setArchiveSourceProfile: (v: boolean) => void;
  setTransferType: (v: "PERMANENT" | "TASK_FORCE") => void;
}) {
  return (
    <div className="mt-4 p-4 rounded-xl border-2 border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 space-y-3.5 animate-in fade-in shadow-xs">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500 text-white flex-shrink-0 shadow-xs">
          <ArrowRightLeft className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground">
              {ar ? "تسكين موظف من فندق آخر (Cross-Property Transfer)" : "Cross-Property Employee Assignment"}
            </span>
            <Badge variant="outline" className="text-[11px] font-semibold border-amber-500/60 bg-amber-100/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
              {selectedProfile.propertyName || (ar ? "فندق خارجي" : "Foreign Hotel")} ➔ {targetProp?.name || (ar ? "الفندق الحالي" : "Target Hotel")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? `هذا الموظف مسجل حالياً في (${selectedProfile.propertyName}). سيتم مزامنة بياناته ومستنداته إلى (${targetProp?.name}) بشكل كامل وفوري.`
              : `This employee belongs to (${selectedProfile.propertyName}). Personal data and documents will be synchronized to (${targetProp?.name}).`}
          </p>
        </div>
      </div>

      {/* ⚠️ تنبيه الإقامة الحالية في الفندق القديم */}
      {(selectedProfile as any).accommodationRoom && (
        <div className="p-3 rounded-lg border-2 border-amber-500/60 bg-amber-100/90 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold">
              {ar
                ? `تنبيه: الموظف ساكن حالياً في ${selectedProfile.propertyName} - غرفة رقم ${(selectedProfile as any).accommodationRoom}${(selectedProfile as any).accommodationBed ? ` (سرير ${(selectedProfile as any).accommodationBed})` : ""}!`
                : `Notice: Resident is currently housed in ${selectedProfile.propertyName} - Room ${(selectedProfile as any).accommodationRoom}${(selectedProfile as any).accommodationBed ? ` (Bed ${(selectedProfile as any).accommodationBed})` : ""}!`}
            </p>
            <p className="text-muted-foreground dark:text-amber-200/90 leading-relaxed">
              {ar
                ? "⚡ سيقوم النظام تلقائياً بإنهاء إقامته السابقة (Check-out) وتحرير السرير هناك فور تأكيد التسكين، مع الحفاظ الكامل على كافة سجلات الغرف ولوج الإقامات السابقة بنسبة 100% دون أي حذف."
                : "System will automatically check out previous accommodation and release bed upon assignment, preserving 100% of historical room logs."}
            </p>
          </div>
        </div>
      )}

      {/* سؤال مصير البروفايل في الفندق القديم */}
      <div className="space-y-2 pt-1">
        <label className="text-xs font-bold text-foreground block">
          {ar
            ? `ماذا تريد أن تفعل بملف الموظف في الفندق القديم (${selectedProfile.propertyName})؟`
            : `What should happen to the profile in (${selectedProfile.propertyName})?`}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setArchiveSourceProfile(true);
              setTransferType("PERMANENT");
            }}
            className={`p-3 rounded-xl border text-start transition-all cursor-pointer relative ${
              archiveSourceProfile
                ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                : "bg-background border-border hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {ar ? "1. نقله وحذفه من قائمة الفندق القديم" : "1. Transfer & Archive From Old Hotel"}
              </span>
              {archiveSourceProfile && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <Badge variant="outline" className="mt-1 text-[10px] font-medium bg-muted/60 text-muted-foreground">
              {ar ? "أرشفة لمنع تكرار الموظف" : "Archive to avoid duplicate"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {ar
                ? "نقل الموظف نهائياً وأرشفة ملفه القديم لعدم ظهوره مرتين، مع بقاء كل سجلات وغرف الإقامة القديمة واللوج 100%."
                : "Permanently move employee, archiving old profile while fully preserving past room stay logs."}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setArchiveSourceProfile(false);
              setTransferType("TASK_FORCE");
            }}
            className={`p-3 rounded-xl border text-start transition-all cursor-pointer relative ${
              !archiveSourceProfile
                ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                : "bg-background border-border hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {ar ? "2. نقله وتسيب البروفايل موجود ونشط" : "2. Keep Profile Active in Both Hotels"}
              </span>
              {!archiveSourceProfile && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <Badge variant="outline" className="mt-1 text-[10px] font-medium bg-muted/60 text-muted-foreground">
              {ar ? "انتداب / استمرار في الفندقين" : "Secondment / Dual Property"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {ar
                ? "تسكين الموظف هنا مع إبقاء ملفه موجوداً ونشطاً في الفندق القديم أيضاً (مناسب للانتداب أو العمل المشترك بالفرعين)."
                : "Assign resident here while keeping profile active in the source property (for Task Force / dual work)."}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
