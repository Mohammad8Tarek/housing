import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

export interface PolicyViolationItem {
  rule?: string;
  messageAr: string;
  messageEn: string;
  severity?: "error" | "warning";
}

interface PolicyExceptionApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleAr?: string;
  titleEn?: string;
  violations: PolicyViolationItem[];
  onConfirm: (approval: { approvedBy: string; reason: string }) => void;
  isLoading?: boolean;
}

export function PolicyExceptionApprovalModal({
  open,
  onOpenChange,
  titleAr,
  titleEn,
  violations,
  onConfirm,
  isLoading = false,
}: PolicyExceptionApprovalModalProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [approvedBy, setApprovedBy] = useState("");
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!approvedBy.trim()) {
      toast.error(
        ar
          ? "يرجى تحديد اسم أو جهة الاعتماد المصرحة بالاستثناء"
          : "Please specify authorizing authority for policy exception",
      );
      return;
    }
    if (!reason.trim()) {
      toast.error(
        ar
          ? "يرجى كتابة سبب التسكين أو النقل الاستثنائي"
          : "Please enter operational reason for this exception",
      );
      return;
    }
    onConfirm({ approvedBy: approvedBy.trim(), reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
            <ShieldAlert className="w-5 h-5" />
            {ar
              ? titleAr || "اعتماد استثناء لسياسة الإسكان والتسكين"
              : titleEn || "Housing Policy Exception Approval"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Policy Violations List */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {ar ? "المخالفات المرصودة آلياً:" : "Detected Policy Violations:"}
            </span>
            <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-100">
              {violations.map((v, i) => (
                <li key={i} className="font-medium">
                  {ar ? v.messageAr : v.messageEn}
                </li>
              ))}
            </ul>
          </div>

          {/* Authorizing Authority */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              {ar
                ? "المعتمد للطلب / الجهة المصرحة بالاستثناء *"
                : "Authorizing Authority *"}
            </label>
            <Input
              placeholder={
                ar
                  ? "مثال: مدير السكن / مدير الموارد البشرية / المدير العام"
                  : "e.g. Housing Manager / HR Director / General Manager"
              }
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
            />
            <div className="flex gap-1.5 flex-wrap pt-1">
              {[
                ar ? "مدير السكن" : "Housing Manager",
                ar ? "مدير الموارد البشرية" : "HR Director",
                ar ? "المدير العام" : "General Manager",
              ].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7 px-2"
                  onClick={() => setApprovedBy(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

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
                  ? "يرجى كتابة سبب الإجراء الاستثنائي ومبررات الإدارة..."
                  : "Please state justification and operational background..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
                  className="text-[10px] h-6 px-1.5 bg-muted/30"
                  onClick={() =>
                    setReason((prev) =>
                      prev ? `${prev} - ${reasonChip}` : reasonChip,
                    )
                  }
                >
                  + {reasonChip}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {ar ? "إلغاء والتراجع" : "Cancel"}
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            <ShieldAlert className="w-4 h-4" />
            {ar ? "اعتماد الاستثناء وتأكيد التسكين" : "Approve & Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
