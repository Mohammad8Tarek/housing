// Meta WhatsApp Cloud API configuration and setup guide.
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
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Loader2,
  Info,
  KeyRound,
  ExternalLink,
  Zap,
  Award,
  HelpCircle,
  Check,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderMetaCloudCard(s: WhatsAppSettingsSectionState) {
  const {
    ar,
    saving,
    metaPhoneNumberId,
    setMetaPhoneNumberId,
    metaWabaId,
    setMetaWabaId,
    metaAccessToken,
    setMetaAccessToken,
    hasMetaToken,
    showMetaGuide,
    setShowMetaGuide,
    handleSaveConfig,
  } = s;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                {ar
                  ? "إعدادات Meta WhatsApp Cloud API"
                  : "Meta WhatsApp Cloud API Configuration"}
                {metaPhoneNumberId && hasMetaToken ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ar ? "معتمد وجاهز للإرسال" : "Authorized & Ready"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1.5"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {ar ? "بحاجة لبيانات الاعتماد" : "Credentials Required"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">
                {ar
                  ? "إرسال رسمي فائق السرعة عبر خوادم Meta مع أمان كامل 100% ضد أي حظر أو إيقاف + 1000 محادثة مجانية شهرياً"
                  : "Official enterprise delivery through Meta with 100% zero ban risk + 1,000 free conversations/month"}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMetaGuide(!showMetaGuide)}
              className="gap-1.5 text-xs font-semibold"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>
                {showMetaGuide
                  ? ar
                    ? "إخفاء الدليل"
                    : "Hide Guide"
                  : ar
                    ? "دليل الربط المجاني (3 دقائق)"
                    : "Setup Guide"}
              </span>
            </Button>
            <PermissionGate module="whatsapp" action="edit">
              <Button
                size="sm"
                onClick={() => handleSaveConfig("meta_cloud")}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold text-xs shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{ar ? "حفظ بيانات الاعتماد" : "Save Credentials"}</span>
              </Button>
            </PermissionGate>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* Status Reassurance Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>
                  {ar
                    ? "الحل النهائي والدائم لمشكلة الحظر"
                    : "The Permanent Zero-Ban Solution"}
                </span>
                <Badge className="bg-emerald-500 text-white text-[10px]">
                  Meta Verified
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "لأن الرسائل تخرج مباشرة من خوادم Meta الرسمية كـ Business API، لا يمكن لحسابك التعرض لأي حظر مؤقت أو دائم."
                  : "Direct Graph API transmission means zero risk of phone bans or spam blocks."}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>
              {ar ? "1,000 محادثة مجانية شهرياً" : "1,000 Free msgs/month"}
            </span>
          </div>
        </div>

        {/* Quick Setup Guide Accordion */}
        {showMetaGuide && (
          <div className="p-5 rounded-2xl bg-muted/40 border border-border/80 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>
                  {ar
                    ? "دليل تفعيل Meta WhatsApp Cloud API مجاناً في 3 دقائق:"
                    : "3-Minute Free Meta Cloud API Setup Guide:"}
                </span>
              </div>
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>
                  {ar ? "فتح Meta Developers" : "Open Meta Developers"}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="p-3 rounded-xl bg-background border space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[11px] flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>
                    {ar ? "إنشاء تطبيق Business" : "Create Business App"}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {ar
                    ? "سجّل دخولك في developers.facebook.com واضغط Create App ثم اختر النوع Other > Business."
                    : "Log into developers.facebook.com, click Create App, select Other > Business."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-background border space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[11px] flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>
                    {ar ? "إضافة WhatsApp للتطبيق" : "Add WhatsApp Product"}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {ar
                    ? "في لوحة تحكم التطبيق، ابحث عن منتج WhatsApp واضغط Set up للبدء."
                    : "In your app dashboard, locate the WhatsApp card and click Set up."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-background border space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[11px] flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>
                    {ar ? "نسخ Phone Number ID و WABA ID" : "Copy IDs"}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {ar
                    ? "من صفحة WhatsApp > API Setup، انسخ Phone Number ID و WhatsApp Business Account ID والصقهما في الخانات أدناه."
                    : "From WhatsApp > API Setup, copy Phone Number ID and WABA ID into the fields below."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-background border space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[11px] flex items-center justify-center font-bold">
                    4
                  </span>
                  <span>
                    {ar
                      ? "رمز الوصول الدائم (Permanent Token)"
                      : "System User Token"}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {ar
                    ? "من Business Settings > System Users أنشئ مستخدم نظام وأعطه صلاحية whatsapp_business_messaging لتوليد توكن دائم لا ينتهي."
                    : "In Business Settings > System Users create a system user with whatsapp_business_messaging permission to get a permanent token."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Credential Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {ar
                  ? "معرّف رقم الهاتف (Phone Number ID):"
                  : "Phone Number ID:"}
              </span>
            </Label>
            <Input
              placeholder={
                ar ? "مثال: 104829102938475" : "e.g. 104829102938475"
              }
              value={metaPhoneNumberId}
              onChange={(e) => setMetaPhoneNumberId(e.target.value)}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "الرقم التعريفي الخاص برقم واتساب المستخرج من صفحة API Setup في Meta"
                : "Found in your Meta Developer Portal under WhatsApp > API Setup"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {ar
                  ? "معرّف حساب الأعمال (WABA ID):"
                  : "WhatsApp Business Account ID:"}
              </span>
            </Label>
            <Input
              placeholder={
                ar ? "مثال: 293847561029384" : "e.g. 293847561029384"
              }
              value={metaWabaId}
              onChange={(e) => setMetaWabaId(e.target.value)}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "معرّف حساب واتساب للأعمال (WhatsApp Business Account ID)"
                : "Your WhatsApp Business Account ID in Meta Business Suite"}
            </p>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {ar
                    ? "رمز الوصول الدائم (Meta Access Token):"
                    : "Permanent Access Token:"}
                </span>
              </Label>
              {hasMetaToken && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1"
                >
                  <Check className="w-3 h-3" />
                  {ar ? "التوكن محفوظ ومفعل بنجاح" : "Token Saved"}
                </Badge>
              )}
            </div>
            <Input
              type="password"
              placeholder={
                hasMetaToken
                  ? ar
                    ? "•••••••••••••••••••••••••••••••••••• (محفوظ مسبقاً، اتركه فارغاً للإبقاء عليه دون تغيير)"
                    : "•••••••••••••••••••••••••••••••••••• (Token is securely saved, leave empty to keep unchanged)"
                  : "EAAG..."
              }
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "رمز الوصول الدائم (Permanent System User Token) برخصة whatsapp_business_messaging"
                : "Permanent access token generated from Meta Business Suite System Users"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
