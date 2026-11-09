import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/date-utils";
import { Phone, AlertTriangle, MessageSquare, Send, Loader2 } from "lucide-react";
import type { Setter, WhatsAppDialogState } from "../types";

interface WhatsAppConfirmationDialogProps {
  ar: boolean;
  whatsAppDialog: WhatsAppDialogState;
  setWhatsAppDialog: Setter<WhatsAppDialogState>;
  whatsAppPhone: string;
  setWhatsAppPhone: Setter<string>;
  isSendingWhatsApp: boolean;
  handleSendWhatsAppConfirmation: () => void;
}

export function WhatsAppConfirmationDialog({
  ar, whatsAppDialog, setWhatsAppDialog, whatsAppPhone, setWhatsAppPhone,
  isSendingWhatsApp, handleSendWhatsAppConfirmation,
}: WhatsAppConfirmationDialogProps) {
  return (

      <Dialog
        open={whatsAppDialog.open}
        onOpenChange={(o) => !o && setWhatsAppDialog({ open: false, reservation: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              </div>
              {ar ? "إرسال تأكيد الحجز (واتساب)" : "Send WhatsApp Confirmation"}
            </DialogTitle>
          </DialogHeader>

          {whatsAppDialog.reservation && (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{ar ? "اسم النزيل:" : "Guest Name:"}</span>
                  <span className="font-semibold text-foreground">
                    {whatsAppDialog.reservation.firstName} {whatsAppDialog.reservation.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{ar ? "رقم الحجز:" : "Booking Ref:"}</span>
                  <span className="font-mono font-bold text-foreground">#{whatsAppDialog.reservation.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{ar ? "تاريخ الوصول:" : "Check-in:"}</span>
                  <span className="font-medium text-foreground">{formatDate(whatsAppDialog.reservation.checkInDate)}</span>
                </div>
                {whatsAppDialog.reservation.roomNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{ar ? "الغرفة المحجوزة:" : "Reserved Room:"}</span>
                    <span className="font-semibold text-foreground">
                      غرفة {whatsAppDialog.reservation.roomNumber}
                    </span>
                  </div>
                )}
              </div>

              {!whatsAppPhone.trim() && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>{ar ? "تنبيه: لا يوجد رقم هاتف مسجل لهذا الحجز. يرجى إدخال الرقم أدناه:" : "Notice: No phone recorded. Enter WhatsApp phone below:"}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{ar ? "رقم هاتف الواتساب للمستلم:" : "Recipient WhatsApp Phone:"}</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="01xxxxxxxxx أو 201xxxxxxxxx"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value)}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ar
                    ? "سيتم إرسال رسالة تأكيد الحجز الرسمية، مع حفظ الرقم تلقائياً في بيانات الحجز والملف الشخصي."
                    : "Official booking confirmation will be dispatched and phone will be updated."}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setWhatsAppDialog({ open: false, reservation: null })}
                  disabled={isSendingWhatsApp}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={handleSendWhatsAppConfirmation}
                  disabled={isSendingWhatsApp || !whatsAppPhone.trim()}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSendingWhatsApp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {ar ? "جاري الإرسال..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {ar ? "إرسال الآن" : "Send Now"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
