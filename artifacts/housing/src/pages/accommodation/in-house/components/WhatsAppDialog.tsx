import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquare, Info, Clock, Send } from "lucide-react";
import { EmpAvatar } from "./EmpAvatar";

export type WhatsAppDialogState = {
  open: boolean;
  assignmentId: number | null;
  emp: any | null;
  roomNumber?: string;
  bedNumber?: any;
};

type Props = {
  ar: boolean;
  dialog: WhatsAppDialogState;
  setDialog: React.Dispatch<React.SetStateAction<WhatsAppDialogState>>;
  phone: string;
  setPhone: (v: string) => void;
  isSending: boolean;
  onSend: () => void;
};

export function WhatsAppDialog({
  ar,
  dialog: whatsAppDialog,
  setDialog: setWhatsAppDialog,
  phone: whatsAppPhone,
  setPhone: setWhatsAppPhone,
  isSending: isSendingWhatsApp,
  onSend: handleSendWhatsApp,
}: Props) {
  return (
    <Dialog
      open={whatsAppDialog.open}
      onOpenChange={(open) =>
        setWhatsAppDialog((prev) => ({ ...prev, open }))
      }
    >
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "إرسال تفاصيل التسكين عبر الواتساب" : "Send WhatsApp Check-in Details"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            {ar ? "إرسال تفاصيل التسكين عبر الواتساب" : "Send WhatsApp Check-in Details"}
          </DialogTitle>
        </DialogHeader>

        {whatsAppDialog.emp && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
            <EmpAvatar emp={whatsAppDialog.emp} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {whatsAppDialog.emp.firstName} {whatsAppDialog.emp.lastName}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-medium">#{whatsAppDialog.emp.id || whatsAppDialog.emp.profileId}</span>
                {whatsAppDialog.roomNumber && (
                  <>
                    <span>•</span>
                    <span>
                      {ar ? "غرفة" : "Room"} {whatsAppDialog.roomNumber}
                      {whatsAppDialog.bedNumber ? ` (${ar ? "سرير" : "Bed"} ${whatsAppDialog.bedNumber})` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!whatsAppDialog.emp?.phone && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {ar ? "لا يوجد رقم هاتف مسجل في ملف الموظف" : "No phone number registered for this employee"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {ar
                  ? "أدخل رقم الواتساب بالأسفل ليتم حفظه تلقائياً في ملف الموظف وإرسال رسالة التسكين الترحيبية وتفاصيل الغرفة إليه فوراً."
                  : "Enter the WhatsApp number below to save it to their profile and send check-in details immediately."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">
              {ar ? "رقم هاتف الواتساب للموظف" : "WhatsApp Phone Number"} *
            </Label>
            <Input
              placeholder="010xxxxxxxx أو 201xxxxxxxxx"
              value={whatsAppPhone}
              onChange={(e) => setWhatsAppPhone(e.target.value)}
              dir="ltr"
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "سيتم إرسال رسالة ترحيبية تشمل اسم الفندق، المبنى، الدور، الغرفة، السرير، ورابط بوابة المقيمين."
                : "Includes hotel name, building, room, bed, and portal link."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWhatsAppDialog((prev) => ({ ...prev, open: false }))}
              disabled={isSendingWhatsApp}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp || !whatsAppPhone.trim()}
            >
              {isSendingWhatsApp ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {ar ? "إرسال الرسالة الآن" : "Send Message Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
