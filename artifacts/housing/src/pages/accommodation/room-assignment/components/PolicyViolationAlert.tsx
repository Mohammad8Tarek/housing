import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import type { PolicyCheckResult } from "../types";

/** تنبيه مخالفة سياسة التسكين (inline, under the room picker) */
export function PolicyViolationAlert({
  ar,
  policyCheck,
  policyOverride,
  setPolicyOverride,
  policyOverrideReason,
  setPolicyOverrideReason,
}: {
  ar: boolean;
  policyCheck: PolicyCheckResult;
  policyOverride: boolean;
  setPolicyOverride: (v: boolean) => void;
  policyOverrideReason: string;
  setPolicyOverrideReason: (v: string) => void;
}) {
  return (
    <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 space-y-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-sm">
            {ar
              ? "تنبيه: الغرفة المحددة تخالف سياسة التسكين المعتمدة"
              : "Policy Violation Alert: Selected room violates housing policy"}
          </p>
          <ul className="list-disc pe-4 ps-4 space-y-0.5">
            {policyCheck.violations.map((v, idx) => (
              <li key={idx}>{ar ? v.messageAr : v.messageEn}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
          <input
            type="checkbox"
            checked={policyOverride}
            onChange={(e) => setPolicyOverride(e.target.checked)}
            className="rounded text-amber-600 focus:ring-amber-500"
          />
          <span>
            {ar
              ? "تأكيد التجاوز والاستثناء الإداري من السياسة (Administrative Override)"
              : "Confirm administrative override of housing policy"}
          </span>
        </label>
        {policyOverride && (
          <Input
            placeholder={
              ar
                ? "سبب الاستثناء وتصريح الإدارة (إلزامي)..."
                : "Reason for administrative override (Mandatory)..."
            }
            value={policyOverrideReason}
            onChange={(e) => setPolicyOverrideReason(e.target.value)}
            className="text-xs bg-white dark:bg-zinc-900 border-amber-300"
          />
        )}
      </div>
    </div>
  );
}
