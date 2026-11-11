// Custom WhatsApp gateway configuration.
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
  Sparkles,
  Loader2,
  Info,
  KeyRound,
  Check,
  Sliders,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderCustomGatewayCard(s: WhatsAppSettingsSectionState) {
  const {
    ar,
    saving,
    customGatewayUrl,
    setCustomGatewayUrl,
    customGatewayToken,
    setCustomGatewayToken,
    hasCustomGatewayToken,
    setCustomGatewayMethod,
    customGatewayPayloadType,
    setCustomGatewayPayloadType,
    customGatewayPhoneField,
    setCustomGatewayPhoneField,
    customGatewayMessageField,
    setCustomGatewayMessageField,
    handleSaveConfig,
  } = s;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm">
              <Sliders className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                {ar
                  ? "إعدادات البوابة المخصصة (أي برودكت WhatsApp)"
                  : "Custom WhatsApp Gateway Configuration"}
                {customGatewayUrl ? (
                  <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ar ? "معتمد وجاهز للإرسال" : "Configured & Ready"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1.5"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {ar ? "بحاجة للرابط (API URL)" : "API URL Required"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {ar
                  ? "اربط أي مزود خدمة واتساب (Wassenger, Green-API, Chat-API, WppConnect, إلخ) بسهولة ومرونة تامة"
                  : "Connect any WhatsApp API provider (Wassenger, Green-API, Chat-API, WppConnect, etc.)"}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleSaveConfig("custom_gateway")}
              disabled={saving}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {ar ? "حفظ إعدادات البوابة" : "Save Gateway Config"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {/* Quick Presets */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              {ar ? "قوالب سريعة مسبقة الإعداد (Presets):" : "Quick Presets:"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {ar
                ? "اضغط لملء الحقول تلقائياً"
                : "Click to auto-populate fields"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 bg-background hover:bg-muted"
              onClick={() => {
                setCustomGatewayUrl("https://api.wassenger.com/v1/messages");
                setCustomGatewayMethod("POST");
                setCustomGatewayPayloadType("json");
                setCustomGatewayPhoneField("phone");
                setCustomGatewayMessageField("message");
                toast.info(
                  ar ? "تم ضبط إعدادات Wassenger" : "Wassenger preset loaded",
                );
              }}
            >
              Wassenger
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 bg-background hover:bg-muted"
              onClick={() => {
                setCustomGatewayUrl(
                  "https://api.green-api.com/waInstance{instanceId}/sendMessage/{token}",
                );
                setCustomGatewayMethod("POST");
                setCustomGatewayPayloadType("json");
                setCustomGatewayPhoneField("chatId");
                setCustomGatewayMessageField("message");
                toast.info(
                  ar ? "تم ضبط إعدادات Green-API" : "Green-API preset loaded",
                );
              }}
            >
              Green-API
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 bg-background hover:bg-muted"
              onClick={() => {
                setCustomGatewayUrl(
                  "https://api.ultramsg.com/instance193010/messages/chat",
                );
                setCustomGatewayMethod("POST");
                setCustomGatewayPayloadType("urlencoded");
                setCustomGatewayPhoneField("to");
                setCustomGatewayMessageField("body");
                toast.info(
                  ar
                    ? "تم ضبط إعدادات UltraMsg كبوابة مخصصة"
                    : "UltraMsg loaded as custom gateway",
                );
              }}
            >
              UltraMsg Gateway
            </Button>
          </div>
        </div>

        {/* Core Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {ar
                  ? "رابط نقطة الاتصال (API Endpoint URL):"
                  : "API Endpoint URL:"}
              </span>
            </Label>
            <Input
              placeholder="https://api.example.com/v1/send-message"
              value={customGatewayUrl}
              onChange={(e) => setCustomGatewayUrl(e.target.value)}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "الرابط الكامل للإرسال من المزود. يدعم المتغيرات التلقائية {phone} و {token}"
                : "The full send endpoint. Supports placeholders {phone} and {token}"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {ar
                  ? "مفتاح الوصول / الرمز (Token / API Key):"
                  : "API Key / Token:"}
              </span>
            </Label>
            <Input
              type="password"
              placeholder={
                hasCustomGatewayToken
                  ? "•••••••••••••••••••••• (محفوظ مسبقاً)"
                  : "Enter API token..."
              }
              value={customGatewayToken}
              onChange={(e) => setCustomGatewayToken(e.target.value)}
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "يتم تمريره تلقائياً في Authorization Header أو كباراميتر"
                : "Automatically sent in Authorization header or body"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {ar
                  ? "نوع حمولة البيانات (Payload Format):"
                  : "Payload Format:"}
              </span>
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={
                  customGatewayPayloadType === "json" ? "default" : "outline"
                }
                className={`flex-1 text-xs ${customGatewayPayloadType === "json" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                onClick={() => setCustomGatewayPayloadType("json")}
              >
                JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  customGatewayPayloadType === "urlencoded"
                    ? "default"
                    : "outline"
                }
                className={`flex-1 text-xs ${customGatewayPayloadType === "urlencoded" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                onClick={() => setCustomGatewayPayloadType("urlencoded")}
              >
                Form-UrlEncoded
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  customGatewayPayloadType === "query" ? "default" : "outline"
                }
                className={`flex-1 text-xs ${customGatewayPayloadType === "query" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                onClick={() => setCustomGatewayPayloadType("query")}
              >
                GET / Query
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              {ar
                ? "اسم حقل الهاتف في الـ API (Phone Field Name):"
                : "Phone Field Name:"}
            </Label>
            <Input
              placeholder="to / phone / chatId"
              value={customGatewayPhoneField}
              onChange={(e) => setCustomGatewayPhoneField(e.target.value)}
              className="font-mono text-xs"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              {ar
                ? "اسم حقل الرسالة في الـ API (Message Field Name):"
                : "Message Field Name:"}
            </Label>
            <Input
              placeholder="body / message / text"
              value={customGatewayMessageField}
              onChange={(e) => setCustomGatewayMessageField(e.target.value)}
              className="font-mono text-xs"
              dir="ltr"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
