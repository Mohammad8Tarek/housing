// Message template editor (check-in / reservation, AR/EN).
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Sparkles, RotateCcw, Loader2, CheckCheck, Globe, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { DEFAULT_TEMPLATE_AR, DEFAULT_TEMPLATE_EN, DEFAULT_RES_TEMPLATE_AR, DEFAULT_RES_TEMPLATE_EN, VARIABLE_TAGS, RESERVATION_TAGS } from "./WhatsAppSettingsSection.constants";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderTemplateEditorCard(s: WhatsAppSettingsSectionState) {
  const { ar, saving, welcomeTemplateAr, setWelcomeTemplateAr, welcomeTemplateEn, setWelcomeTemplateEn, reservationTemplateAr, setReservationTemplateAr, reservationTemplateEn, setReservationTemplateEn, templateCategory, setTemplateCategory, activeTemplateTab, setActiveTemplateTab, textareaArRef, textareaEnRef, handleSaveConfig, handleInsertTag, mockVars, previewText } = s;
  return (
<Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold">
                {ar ? "محرر قوالب رسائل الواتساب" : "WhatsApp Message Template Editor"}
              </CardTitle>
              <CardDescription>
                {ar
                  ? "قم بتخصيص نص الرسائل التلقائية للتسكين أو تأكيد الحجز مع دعم كامل للرموز التعبيرية والمتغيرات"
                  : "Customize automated messages for check-in or reservations with emojis and dynamic variables"}
              </CardDescription>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>
                  {ar
                    ? "تحديد اللغة ذكي وتلقائي: ترسل الرسالة بالعربية للجنسيات المصرية والعربية، وبالإنجليزية للجنسيات الأجنبية"
                    : "Auto-Language: Dispatched in Arabic for Egyptian & Arab nationalities, and in English for foreign nationalities"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (templateCategory === "checkin") {
                    if (activeTemplateTab === "ar") setWelcomeTemplateAr(DEFAULT_TEMPLATE_AR);
                    else setWelcomeTemplateEn(DEFAULT_TEMPLATE_EN);
                  } else {
                    if (activeTemplateTab === "ar") setReservationTemplateAr(DEFAULT_RES_TEMPLATE_AR);
                    else setReservationTemplateEn(DEFAULT_RES_TEMPLATE_EN);
                  }
                  toast.info(ar ? "تم استعادة القالب الافتراضي" : "Reset to default template");
                }}
                className="gap-1 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {ar ? "استعادة الافتراضي" : "Reset"}
              </Button>
              <PermissionGate module="whatsapp" action="edit">
                <Button
                  size="sm"
                  onClick={() => handleSaveConfig()}
                  disabled={saving}
                  className="gap-1.5 font-semibold text-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {ar ? "حفظ القوالب والإعدادات" : "Save All Templates"}
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Template Category Switcher */}
          <div className="flex items-center gap-2 pt-3 border-t mt-2">
            <Button
              type="button"
              variant={templateCategory === "checkin" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateCategory("checkin")}
              className="gap-2 text-xs font-semibold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {ar ? "رسائل التسكين المباشر (Check-In)" : "Check-in Messages"}
            </Button>
            <Button
              type="button"
              variant={templateCategory === "reservation" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateCategory("reservation")}
              className="gap-2 text-xs font-semibold"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              {ar ? "رسائل تأكيد الحجوزات المسبقة (Reservations)" : "Reservation Confirmation"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Variable Insert Chips */}
          <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {ar
                  ? `انقر على أي متغير لإدراجه في موضع المؤشر (${templateCategory === "checkin" ? "قالب التسكين" : "قالب الحجز"}):`
                  : `Click any variable to insert at cursor (${templateCategory === "checkin" ? "Check-in" : "Reservation"}):`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(templateCategory === "checkin" ? VARIABLE_TAGS : RESERVATION_TAGS).map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertTag(v.tag)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-card hover:bg-primary/10 border hover:border-primary/40 text-foreground transition-colors flex items-center gap-1 active:scale-95 shadow-2xs"
                  title={ar ? v.labelAr : v.labelEn}
                >
                  <span className="text-primary font-mono font-bold">{v.tag}</span>
                  <span className="text-muted-foreground text-[10.5px]">({ar ? v.labelAr : v.labelEn})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs & Layout: Editor on Left, Live Mockup on Right */}
          <Tabs
            value={activeTemplateTab}
            onValueChange={(val) => setActiveTemplateTab(val as "ar" | "en")}
            className="w-full"
          >
            <TabsList className="w-full max-w-xs mb-3">
              <TabsTrigger value="ar" className="flex-1">
                🇪🇬 {ar ? "القالب العربي" : "Arabic Template"}
              </TabsTrigger>
              <TabsTrigger value="en" className="flex-1">
                🇬🇧 {ar ? "القالب الإنجليزي" : "English Template"}
              </TabsTrigger>
            </TabsList>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Textarea Editor */}
              <div className="lg:col-span-7 space-y-3">
                <TabsContent value="ar" className="m-0 space-y-2">
                  <Textarea
                    ref={textareaArRef}
                    rows={12}
                    dir="rtl"
                    value={templateCategory === "checkin" ? welcomeTemplateAr : reservationTemplateAr}
                    onChange={(e) =>
                      templateCategory === "checkin"
                        ? setWelcomeTemplateAr(e.target.value)
                        : setReservationTemplateAr(e.target.value)
                    }
                    className="font-sans leading-relaxed text-sm p-3.5 resize-y shadow-inner"
                    placeholder="اكتب نص القالب هنا..."
                  />
                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>
                      {ar ? "عدد الأحرف:" : "Characters:"}{" "}
                      {(templateCategory === "checkin" ? welcomeTemplateAr : reservationTemplateAr).length}
                    </span>
                    <span>{ar ? "اللغة: العربية (RTL)" : "Language: Arabic (RTL)"}</span>
                  </div>
                </TabsContent>

                <TabsContent value="en" className="m-0 space-y-2">
                  <Textarea
                    ref={textareaEnRef}
                    rows={12}
                    dir="ltr"
                    value={templateCategory === "checkin" ? welcomeTemplateEn : reservationTemplateEn}
                    onChange={(e) =>
                      templateCategory === "checkin"
                        ? setWelcomeTemplateEn(e.target.value)
                        : setReservationTemplateEn(e.target.value)
                    }
                    className="font-sans leading-relaxed text-sm p-3.5 resize-y shadow-inner"
                    placeholder="Type template text here..."
                  />
                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>
                      {ar ? "عدد الأحرف:" : "Characters:"}{" "}
                      {(templateCategory === "checkin" ? welcomeTemplateEn : reservationTemplateEn).length}
                    </span>
                    <span>{ar ? "Language: English (LTR)" : "Language: English (LTR)"}</span>
                  </div>
                </TabsContent>
              </div>

              {/* Right Column: Live Mobile WhatsApp Mockup */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[340px] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-2xl bg-[#0b141a] text-white">
                  {/* WhatsApp Mobile Top Bar */}
                  <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2.5 border-b border-[#2a3942]">
                    <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-xs">
                      SH
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {mockVars.property_name}
                      </div>
                      <div className="text-[10px] text-[#25d366] leading-none">
                        {ar ? "حساب أعمال موثق" : "Verified Business"}
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Chat Wallpaper & Bubble */}
                  <div
                    className="p-3 min-h-[300px] flex flex-col justify-end text-sm"
                    style={{
                      backgroundColor: "#0b141a",
                      backgroundImage:
                        "radial-gradient(#1f2c34 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  >
                    <div
                      className="p-3 rounded-2xl rounded-tr-xs shadow-md space-y-2 max-w-[95%] self-end"
                      style={{ backgroundColor: "#005c4b" }}
                      dir={activeTemplateTab === "ar" ? "rtl" : "ltr"}
                    >
                      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#e9edef] select-none">
                        {previewText}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                        <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground mt-2">
                  {ar
                    ? templateCategory === "checkin"
                      ? "📱 معاينة حية لشاشة هاتف الموظف فور التسكين"
                      : "📱 معاينة حية لرسالة تأكيد الحجز المسبق"
                    : templateCategory === "checkin"
                    ? "📱 Live mobile preview upon check-in"
                    : "📱 Live mobile preview upon reservation confirmation"}
                </span>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
  );
}
