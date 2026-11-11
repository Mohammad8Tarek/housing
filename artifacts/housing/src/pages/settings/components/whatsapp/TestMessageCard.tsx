// Send a test message.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderTestMessageCard(s: WhatsAppSettingsSectionState) {
  const {
    ar,
    testing,
    provider,
    metaPhoneNumberId,
    metaAccessToken,
    hasMetaToken,
    customGatewayUrl,
    status,
    testPhone,
    setTestPhone,
    handleSendTest,
  } = s;
  return (
    <Card className="lg:col-span-5 border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          {ar ? "إرسال رسالة تجريبية" : "Send Test Message"}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? "اختبر وصول الرسالة برقم هاتفك للتأكد من سلامة القالب قبل الاستخدام"
            : "Test message delivery to verify format and phone connectivity"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {ar ? "رقم الهاتف للتجربة:" : "Phone Number for Test:"}
          </label>
          <Input
            placeholder="01012345678"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-[10.5px] text-muted-foreground">
            {ar
              ? "يدعم الأرقام المحلية 01x أو الدولية +20x"
              : "Supports local 01x or international +20x"}
          </p>
        </div>

        <PermissionGate module="whatsapp" action="edit">
          {(() => {
            const isReady =
              provider === "meta_cloud"
                ? Boolean(
                    metaPhoneNumberId &&
                    (hasMetaToken || metaAccessToken.trim()),
                  )
                : provider === "custom_gateway"
                  ? Boolean(customGatewayUrl.trim())
                  : status === "connected";

            return (
              <Button
                onClick={handleSendTest}
                disabled={testing || !isReady}
                className="w-full text-white font-semibold gap-2 shadow-sm"
                style={{
                  backgroundColor: isReady
                    ? provider === "meta_cloud"
                      ? "#059669"
                      : provider === "custom_gateway"
                        ? "#4f46e5"
                        : "#00a884"
                    : undefined,
                }}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {!isReady
                  ? provider === "meta_cloud"
                    ? ar
                      ? "يرجى حفظ بيانات Meta Cloud أولاً"
                      : "Configure Meta Cloud First"
                    : provider === "custom_gateway"
                      ? ar
                        ? "يرجى إدخال رابط الـ API للبوابة المخصصة أولاً"
                        : "Configure Custom Gateway First"
                      : ar
                        ? "يجب ربط الواتساب أولاً"
                        : "Connect WhatsApp First"
                  : provider === "meta_cloud"
                    ? ar
                      ? "إرسال رسالة تجريبية عبر Meta Cloud API"
                      : "Send Test via Meta Cloud API"
                    : provider === "custom_gateway"
                      ? ar
                        ? "إرسال رسالة تجريبية عبر البوابة المخصصة (API)"
                        : "Send Test via Custom Gateway"
                      : ar
                        ? "إرسال الرسالة التجريبية الآن"
                        : "Send Test Message Now"}
              </Button>
            );
          })()}
        </PermissionGate>
      </CardContent>
    </Card>
  );
}
