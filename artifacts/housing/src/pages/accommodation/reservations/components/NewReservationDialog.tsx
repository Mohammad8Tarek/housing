import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BedDouble } from "lucide-react";

interface NewReservationDialogProps {
  ar: boolean;
  newDialogOpen: boolean;
  setNewDialogOpen: (open: boolean) => void;
  step: 1 | 2 | 3;
  personMode: "existing" | "new" | null;
  children: ReactNode;
}

export function NewReservationDialog({
  ar,
  newDialogOpen,
  setNewDialogOpen,
  step,
  personMode,
  children,
}: NewReservationDialogProps) {
  return (
    <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary" />
            {ar ? "حجز / تسكين جديد" : "New Reservation / Assignment"}
          </DialogTitle>
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full flex-1 transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {step === 1 &&
              (ar
                ? "الخطوة 1: تحديد نوع الشخص ونظام الحجز"
                : "Step 1: Choose person type & booking mode")}
            {step === 2 &&
              personMode === "existing" &&
              (ar
                ? "الخطوة 2: البحث عن الموظف المسجل مسبقاً"
                : "Step 2: Search existing registered profile")}
            {step === 2 &&
              personMode === "new" &&
              (ar
                ? "الخطوة 2: إدخال بيانات الملف الجديد والمستندات"
                : "Step 2: Enter new profile data & upload documents")}
            {step === 3 &&
              (ar
                ? "الخطوة 3: اختيار الغرفة وتواريخ الإقامة"
                : "Step 3: Select room and check-in dates")}
          </p>
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  );
}
