import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import type { PolicyCheckResult } from "../types";
import {
  MIN_EXCEPTION_REASON,
  useExceptionApprover,
} from "@/components/PolicyExceptionApprovalModal";

/** Policy Exception Approval Dialog */
export function PolicyExceptionDialog({
  ar,
  open,
  onOpenChange,
  policyCheck,
  policyApprovedBy,
  setPolicyApprovedBy,
  policyOverrideReason,
  setPolicyOverrideReason,
  onApprove,
}: {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyCheck: PolicyCheckResult;
  policyApprovedBy: string;
  setPolicyApprovedBy: (v: string) => void;
  policyOverrideReason: string;
  setPolicyOverrideReason: (v: string) => void;
  onApprove: () => void;
}) {
  const { canApprove } = useExceptionApprover();
  void setPolicyApprovedBy;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
            {ar
              ? "اعتماد استثناء إداري لسياسة التسكين"
              : "Approve Housing Policy Exception"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "يتعارض هذا التسكين مع السياسات المعتمدة (فصل الجنسين / سكن العائلات / سعة الدرجة / فصل الأقسام). يتطلب إتمام العملية تسجيلاً رسمياً لمسوغات الاستثناء والجهة المعتمدة."
              : "This allocation deviates from approved housing policies. Completing it requires recording justification and authorizing authority."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* List of violations */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
            <span className="font-bold block flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {ar ? "المخالفات المرصودة آلياً:" : "Detected Policy Violations:"}
            </span>
            <ul className="list-disc list-inside space-y-1">
              {policyCheck.violations.map((v, i) => (
                <li key={i} className="font-medium">
                  {ar ? v.messageAr : v.messageEn}
                </li>
              ))}
            </ul>
          </div>

          {/* Approver: the signed-in user, recorded by the server */}
          {canApprove ? (
            <div className="text-xs rounded-lg border bg-muted/40 px-3 py-2">
              {ar ? "المعتمِد: " : "Approved by: "}
              <span className="font-bold">{policyApprovedBy}</span>
              <span className="text-muted-foreground">
                {ar
                  ? " — هيتسجل باسم حسابك في السجل"
                  : " — recorded under your account"}
              </span>
            </div>
          ) : (
            <div className="text-xs rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
              {ar
                ? "مش عندك صلاحية اعتماد استثناءات سياسة السكن. اطلب من مدير السكن يعتمدها أو اختار غرفة مطابقة للسياسة."
                : "You don't have permission to approve housing-policy exceptions. Ask a housing manager, or pick a room that meets the policy."}
            </div>
          )}

          {/* Justification / Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              {ar
                ? "مسوغات الاستثناء والسبب الإداري *"
                : "Administrative Justification & Reason *"}
            </label>
            <Textarea
              placeholder={
                ar
                  ? "يرجى كتابة سبب التسكين الاستثنائي ومبررات الإدارة..."
                  : "Please state justification and operational background..."
              }
              value={policyOverrideReason}
              onChange={(e) => setPolicyOverrideReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-1.5 flex-wrap pt-1">
              {[
                ar
                  ? "ظرف تشغيلي طارئ / Task Force"
                  : "Operational Urgency / Task Force",
                ar ? "موافقة المدير العام المسبقة" : "Prior GM Approval",
                ar ? "عدم توفر غرف شاغرة بديلة" : "No Alternative Vacant Rooms",
                ar ? "ترقية استثنائية مؤقتة" : "Temporary Exception Promotion",
              ].map((reasonChip) => (
                <Button
                  key={reasonChip}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 px-2"
                  onClick={() => setPolicyOverrideReason(reasonChip)}
                >
                  {reasonChip}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            onClick={onApprove}
            disabled={
              !canApprove ||
              policyOverrideReason.trim().length < MIN_EXCEPTION_REASON
            }
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
            {ar
              ? "اعتماد الاستثناء وإتمام التسكين"
              : "Approve & Complete Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
