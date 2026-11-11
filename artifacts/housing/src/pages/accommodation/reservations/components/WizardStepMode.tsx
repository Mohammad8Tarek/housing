import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  UserCheck,
  Users,
  CalendarDays,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import type { NewFormState, Setter } from "../types";

interface WizardStepModeProps {
  ar: boolean;
  personMode: "existing" | "new" | null;
  setPersonMode: Setter<"existing" | "new" | null>;
  setNewForm: Setter<NewFormState>;
  bookingType: "direct" | "upcoming";
  setBookingType: Setter<"direct" | "upcoming">;
  setStep: Setter<1 | 2 | 3>;
}

export function WizardStepMode({
  ar,
  personMode,
  setPersonMode,
  setNewForm,
  bookingType,
  setBookingType,
  setStep,
}: WizardStepModeProps) {
  return (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          {ar
            ? "هل الشخص موجود مسبقاً في النظام أم نيو بروفايل؟"
            : "Is this person registered or a new profile?"}
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => {
              setPersonMode("existing");
            }}
            className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${personMode === "existing" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">
                {ar ? "ملف موظف داخلي" : "Internal Profile"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "البحث عن موظف مسجل مسبقاً في النظام"
                  : "Search existing registered employee"}
              </p>
            </div>
          </button>
          <button
            onClick={() => {
              setPersonMode("new");
              setNewForm((f) => ({ ...f, employmentType: "THIRD_PARTY" }));
            }}
            className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${personMode === "new" ? "border-purple-600 bg-purple-500/5 ring-2 ring-purple-500/20" : "border-border hover:border-purple-500/50 hover:bg-muted/30"}`}
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">
                {ar ? "نيو بروفايل" : "New Profile"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "إدخال بيانات شخص وإنشاء بروفايل جديد"
                  : "Enter details & create new profile"}
              </p>
            </div>
          </button>
        </div>
      </div>

      {personMode && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-sm font-semibold">
            {ar ? "طريقة الحجز" : "Booking Mode"}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBookingType("direct")}
              className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left rtl:text-right transition-all ${bookingType === "direct" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
            >
              <CheckCircle
                className={`w-4 h-4 mt-0.5 ${bookingType === "direct" ? "text-primary" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-sm font-semibold">
                  {ar ? "تسكين فوري" : "Direct Assignment"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "تسكين الشخص في الغرفة والسرير الآن"
                    : "Assign to room & bed immediately"}
                </p>
              </div>
            </button>
            <button
              onClick={() => setBookingType("upcoming")}
              className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left rtl:text-right transition-all ${bookingType === "upcoming" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
            >
              <CalendarDays
                className={`w-4 h-4 mt-0.5 ${bookingType === "upcoming" ? "text-primary" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-sm font-semibold">
                  {ar ? "حجز مستقبلي" : "Future Reservation"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "حجز لتاريخ مستقبلي ثم تسكينه لاحقاً"
                    : "Book for future date with check-in later"}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={() => setStep(2)} disabled={!personMode}>
          {ar ? "التالي" : "Next"}{" "}
          <ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
