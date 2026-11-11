import { Loader2 } from "lucide-react";
import { BroadcastWhatsAppDialog } from "@/components/BroadcastWhatsAppDialog";
import { useWhatsAppSettingsSectionState } from "./whatsapp/useWhatsAppSettingsSectionState";
import { renderProviderPicker } from "./whatsapp/ProviderPicker";
import { renderCustomGatewayCard } from "./whatsapp/CustomGatewayCard";
import { renderMetaCloudCard } from "./whatsapp/MetaCloudCard";
import { renderBaileysQrCard } from "./whatsapp/BaileysQrCard";
import { renderOutboxQueueCard } from "./whatsapp/OutboxQueueCard";
import { renderAutoDispatchCard } from "./whatsapp/AutoDispatchCard";
import { renderTemplateEditorCard } from "./whatsapp/TemplateEditorCard";
import { renderTestMessageCard } from "./whatsapp/TestMessageCard";
import { renderDeliveryLogsCard } from "./whatsapp/DeliveryLogsCard";
import { WhatsAppSettingsSectionProps } from "./whatsapp/WhatsAppSettingsSection.constants";

export function WhatsAppSettingsSection(props: WhatsAppSettingsSectionProps) {
  const s = useWhatsAppSettingsSectionState(props);
  const {
    propertyId,
    language,
    ar,
    loading,
    provider,
    broadcastOpen,
    setBroadcastOpen,
  } = s;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>
          {ar
            ? "جاري تحميل إعدادات الواتساب..."
            : "Loading WhatsApp settings..."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* ── PROVIDER SELECTION BAR ── */}
      {renderProviderPicker(s)}

      {/* ── CARD 1: ACTIVE PROVIDER CONFIGURATION ── */}
      {provider === "custom_gateway"
        ? /* CUSTOM / ANY WHATSAPP GATEWAY CARD */
          renderCustomGatewayCard(s)
        : provider === "meta_cloud"
          ? /* META CLOUD API CARD */
            renderMetaCloudCard(s)
          : /* DIRECT BAILEYS QR CODE CARD */
            renderBaileysQrCard(s)}

      {/* ── PERSISTENT OUTBOX QUEUE STATUS CARD ── */}
      {renderOutboxQueueCard(s)}

      {/* ── CARD 2: AUTOMATION TOGGLE & SUPERVISOR CONTACT ── */}
      {renderAutoDispatchCard(s)}

      {/* ── CARD 3: TEMPLATE EDITOR & LIVE PREVIEW ── */}
      {renderTemplateEditorCard(s)}

      {/* ── CARD 4: TEST SENDER & DELIVERY LOGS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Test Sender */}
        {renderTestMessageCard(s)}

        {/* Delivery Logs */}
        {renderDeliveryLogsCard(s)}
      </div>

      {/* Broadcast WhatsApp Dialog */}
      <BroadcastWhatsAppDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        propertyId={propertyId}
        language={language}
      />
    </div>
  );
}
