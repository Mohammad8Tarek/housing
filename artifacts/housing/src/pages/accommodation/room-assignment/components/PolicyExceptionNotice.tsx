import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { PolicyCheckResult } from "../types";

/** Policy Compliance & Exception Notice (above the submit button) */
export function PolicyExceptionNotice({
  ar,
  policyCheck,
  policyOverride,
  policyOverrideReason,
  policyApprovedBy,
  onOpenExceptionModal,
}: {
  ar: boolean;
  policyCheck: PolicyCheckResult;
  policyOverride: boolean;
  policyOverrideReason: string;
  policyApprovedBy: string;
  onOpenExceptionModal: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
        policyOverride
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
          : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-start gap-2.5">
          {policyOverride ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold text-sm block">
              {policyOverride
                ? ar
                  ? "تم اعتماد الاستثناء الإداري للسياسة"
                  : "Policy Exception Approved"
                : ar
                  ? "تنبيه: التسكين يتعارض مع سياسات السكن المعتمدة"
                  : "Notice: Allocation Conflicts with Housing Policy"}
            </span>
            <ul className="text-xs list-disc list-inside mt-1 space-y-1">
              {policyCheck.violations.map((v, idx) => (
                <li
                  key={idx}
                  className="font-medium text-amber-900 dark:text-amber-300"
                >
                  {ar ? v.messageAr : v.messageEn}
                </li>
              ))}
            </ul>
            {policyOverride && policyOverrideReason && (
              <p className="text-xs mt-2 text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-900/40 p-2 rounded-md font-medium">
                <strong>{ar ? "سبب الاستثناء:" : "Reason:"}</strong>{" "}
                {policyOverrideReason}
                {policyApprovedBy &&
                  ` — ${ar ? "المعتمد:" : "Approved by:"} ${policyApprovedBy}`}
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant={policyOverride ? "outline" : "default"}
          size="sm"
          onClick={onOpenExceptionModal}
          className={`text-xs shrink-0 ${
            policyOverride
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
          {policyOverride
            ? ar
              ? "تعديل الاستثناء"
              : "Edit Exception"
            : ar
              ? "طلب اعتماد استثناء"
              : "Approve Exception"}
        </Button>
      </div>
    </div>
  );
}
