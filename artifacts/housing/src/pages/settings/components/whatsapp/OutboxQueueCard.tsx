// Offline outbox queue.
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Layers } from "lucide-react";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderOutboxQueueCard(s: WhatsAppSettingsSectionState) {
  const { ar, status, pendingQueueCount, processingQueue, handleProcessQueue } =
    s;
  return (
    <Card
      className={`border-border/60 shadow-sm transition-all ${
        pendingQueueCount > 0
          ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
          : "bg-muted/20"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                pendingQueueCount > 0
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold flex items-center gap-2">
                <span>
                  {ar
                    ? "طابور العمليات غير المتصلة (Offline Outbox Queue)"
                    : "Offline Outbox Queue"}
                </span>
                {pendingQueueCount > 0 ? (
                  <Badge className="bg-amber-500 text-white border-0 text-xs px-2 py-0.5 animate-pulse">
                    {ar
                      ? `${pendingQueueCount} رسالة معلقة`
                      : `${pendingQueueCount} Pending`}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-emerald-600 border-emerald-500/30 text-xs"
                  >
                    {ar ? "تم إرسال كل العمليات" : "All Processed"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {pendingQueueCount > 0
                  ? ar
                    ? `يوجد ${pendingQueueCount} عملية تسكين أو حجز محفوظة بأمان في قاعدة البيانات، وسيتم إرسالها تلقائياً فور عودة اتصال الواتساب.`
                    : `${pendingQueueCount} check-in or booking notifications saved safely in DB. They will dispatch automatically upon WhatsApp reconnection.`
                  : ar
                    ? "نظام الحفظ الدائم نشط: أي عملية تسكين أو حجز تتم أثناء انقطاع اتصال الواتساب تُحفظ تلقائياً في هذا الطابور ولا تضيع أبداً."
                    : "Active offline buffer: Any accommodation or reservation performed while disconnected is queued and auto-dispatched."}
              </p>
            </div>
          </div>

          {pendingQueueCount > 0 && (
            <Button
              size="sm"
              onClick={handleProcessQueue}
              disabled={processingQueue || status !== "connected"}
              className="gap-1.5 text-xs font-semibold self-end sm:self-auto text-white shadow-sm flex-shrink-0"
              style={{
                backgroundColor: status === "connected" ? "#00a884" : undefined,
              }}
            >
              {processingQueue ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {ar ? "معالجة وإرسال الطابور الآن" : "Process Queue Now"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
