// Auto-dispatch and broadcast toggles.
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PhoneCall, Radio } from "lucide-react";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderAutoDispatchCard(s: WhatsAppSettingsSectionState) {
  const {
    ar,
    isAutoSendEnabled,
    setIsAutoSendEnabled,
    isReservationSendEnabled,
    setIsReservationSendEnabled,
    supervisorContact,
    setSupervisorContact,
    setBroadcastOpen,
  } = s;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">
          {ar
            ? "إعدادات الإرسال التلقائي والبث الجماعي"
            : "Auto-Dispatch & Broadcast Configuration"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "التحكم في تفعيل أو إيقاف إرسال رسائل الواتساب الفورية عند التسكين أو الحجز، وإطلاق البث الجماعي"
            : "Toggle automated check-in and reservation WhatsApp messaging, and launch targeted broadcasts"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Check-In Auto-Send Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
          <div className="space-y-0.5">
            <div className="font-semibold text-sm">
              {ar
                ? "إرسال رسالة ترحيب وتفاصيل التسكين تلقائياً عند إجراء Check-In"
                : "Automatically send welcome WhatsApp upon Check-In"}
            </div>
            <div className="text-xs text-muted-foreground">
              {ar
                ? "بمجرد حفظ التسكين لأي موظف يملك رقم هاتف، يصله فوراً إشعار الغرفة والسرير في الخلفية"
                : "Dispatches room and bed details directly to employee's WhatsApp right after assignment"}
            </div>
          </div>
          <Switch
            checked={isAutoSendEnabled}
            onCheckedChange={setIsAutoSendEnabled}
          />
        </div>

        {/* Reservation Confirmation Auto-Send Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
          <div className="space-y-0.5">
            <div className="font-semibold text-sm">
              {ar
                ? "إرسال رسالة تأكيد الحجز المسبق تلقائياً عند إنشاء حجز جديد"
                : "Automatically send reservation confirmation WhatsApp upon booking"}
            </div>
            <div className="text-xs text-muted-foreground">
              {ar
                ? "بمجرد حفظ حجز جديد لنزيل يملك رقم هاتف، تصله فوراً تفاصيل الحجز وموعد الوصول ورقم التأكيد"
                : "Dispatches booking details and expected arrival date directly to guest upon reservation"}
            </div>
          </div>
          <Switch
            checked={isReservationSendEnabled}
            onCheckedChange={setIsReservationSendEnabled}
          />
        </div>

        {/* Broadcast Launch Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20">
          <div className="space-y-0.5">
            <div className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>
                {ar
                  ? "خدمة البث والإرسال الجماعي (Broadcast Messages)"
                  : "Targeted WhatsApp Broadcast Messaging"}
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-0 text-[10px]">
                {ar ? "جديد" : "New"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "إرسال تنبيهات جماعية موجهة لجميع المقيمين، أو لمبنى محدد، أو لدور، أو لغرف معينة، أو لمقيمين محددين مع حماية مكافحة الحظر"
                : "Send targeted broadcasts to all in-house, specific building, floor, rooms, or selected guests with anti-ban pacing"}
            </p>
          </div>
          <PermissionGate module="whatsapp" action="create">
            <Button
              type="button"
              onClick={() => setBroadcastOpen(true)}
              className="text-white gap-2 font-semibold text-xs shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#00a884" }}
            >
              <Radio className="w-4 h-4" />
              {ar ? "فتح نافذة البث الجماعي" : "Launch Broadcast"}
            </Button>
          </PermissionGate>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-primary" />
              {ar
                ? "رقم مسؤول السكن للطوارئ (Supervisor Contact):"
                : "Housing Supervisor Contact Number:"}
            </label>
            <Input
              placeholder="+201012345678"
              value={supervisorContact}
              onChange={(e) => setSupervisorContact(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "يتم تضمين هذا الرقم في القالب عبر المتغير {supervisor_contact}"
                : "Injected dynamically into templates via {supervisor_contact}"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "رابط بوابة المقيمين الافتراضي:" : "Resident Portal URL:"}
            </label>
            <Input
              readOnly
              value="https://resident.sunrise-resorts.com/portal/"
              className="bg-muted text-muted-foreground font-mono text-sm cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "يتم تضمينه تلقائياً في الرسالة عبر {portal_url}"
                : "Injected via {portal_url}"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
