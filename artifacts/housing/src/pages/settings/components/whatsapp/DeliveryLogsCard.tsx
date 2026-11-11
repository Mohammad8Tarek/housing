// Recent delivery logs.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock } from "lucide-react";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderDeliveryLogsCard(s: WhatsAppSettingsSectionState) {
  const { ar, logs, fetchStatusAndConfig } = s;
  return (
    <Card className="lg:col-span-7 border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center justify-between">
          <span>{ar ? "آخر عمليات الإرسال" : "Recent Delivery Logs"}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatusAndConfig}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {ar ? "تحديث" : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {logs.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            {ar
              ? "لا توجد رسائل مرسلة حتى الآن"
              : "No message logs recorded yet"}
          </div>
        ) : (
          <div className="divide-y divide-border/60 text-xs">
            {logs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="font-mono">{log.recipient_phone}</span>
                    {log.recipient_name && (
                      <span className="text-muted-foreground truncate">
                        ({log.recipient_name})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                    {log.message_content}
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  {log.status === "SENT" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
                      {ar ? "تم الإرسال" : "Sent"}
                    </Badge>
                  ) : log.status === "QUEUED" ? (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0.5 gap-1"
                    >
                      <Clock className="w-2.5 h-2.5 animate-spin" />
                      {ar ? "في الانتظار" : "Queued"}
                    </Badge>
                  ) : log.status === "NOT_REGISTERED" ? (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0.5"
                    >
                      {ar ? "غير مسجل بواتساب" : "No WhatsApp"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className="text-[10px] px-1.5 py-0.5"
                    >
                      {ar ? "فشل الإرسال" : "Failed"}
                    </Badge>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
