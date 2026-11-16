// WhatsApp anti-ban safety level (safe / balanced / fast). Scales the daily &
// hourly send caps and the human-like gaps between messages. Opt-in per
// property; saved to the shared settings (/api/settings).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Level = "safe" | "balanced" | "fast";

const LEVELS: {
  id: Level;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}[] = [
  {
    id: "safe",
    ar: "آمن",
    en: "Safe",
    descAr: "أبطأ وأقل عدداً — أقل خطر للبلوك",
    descEn: "Slower, lower volume — lowest ban risk",
  },
  {
    id: "balanced",
    ar: "متوازن",
    en: "Balanced",
    descAr: "السرعة والأمان الافتراضي",
    descEn: "Default speed & safety",
  },
  {
    id: "fast",
    ar: "سريع",
    en: "Fast",
    descAr: "أسرع وعدد أكبر — خطر أعلى",
    descEn: "Faster, higher volume — more risk",
  },
];

export function WhatsAppSafetyCard({
  propertyId,
  ar,
}: {
  propertyId: number | null;
  ar: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["/api/settings", propertyId],
    queryFn: () =>
      customFetch<any>(`/api/settings?propertyId=${propertyId ?? ""}`),
    enabled: !!propertyId,
  });
  const [level, setLevel] = useState<Level>("balanced");
  useEffect(() => {
    if (settings) {
      const v = settings.whatsappSafetyLevel;
      setLevel(v === "safe" || v === "fast" ? v : "balanced");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: (next: Level) =>
      customFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, whatsappSafetyLevel: next }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/settings", propertyId],
      });
      toast.success(ar ? "تم حفظ مستوى الأمان" : "Safety level saved");
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّر الحفظ" : "Could not save")),
  });

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">
              {ar ? "مستوى الحماية من الحظر" : "Anti-ban safety level"}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ar
                ? "يتحكم في الحد اليومي للرسائل والفواصل الزمنية بينها (للرقم العادي عبر QR)."
                : "Controls the daily message cap and the gaps between messages (QR / Baileys number)."}
            </p>
          </div>
          {save.isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ms-auto" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => {
            const active = level === l.id;
            return (
              <Button
                key={l.id}
                type="button"
                variant="outline"
                onClick={() => {
                  setLevel(l.id);
                  if (propertyId) save.mutate(l.id);
                }}
                disabled={!propertyId || save.isPending}
                className={`h-auto flex-col items-start gap-1 py-2.5 px-3 text-start whitespace-normal ${
                  active
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                    : "border-border/60"
                }`}
              >
                <span className="text-sm font-bold">{ar ? l.ar : l.en}</span>
                <span className="text-[10px] font-normal text-muted-foreground leading-tight">
                  {ar ? l.descAr : l.descEn}
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
