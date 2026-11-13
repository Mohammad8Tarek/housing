// Admin view of a user's two-step verification: on/off, and a reset for a
// user who lost their phone (they set it up again after signing in).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-utils";

export function UserTwoFactorCard({
  ar,
  userId,
}: {
  ar: boolean;
  userId: number;
}) {
  const qc = useQueryClient();
  const key = ["/api/users", userId, "2fa"];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      customFetch<{ enabled: boolean; enabledAt: string | null }>(
        `/api/users/${userId}/2fa`,
      ),
  });
  const reset = useMutation({
    mutationFn: () =>
      customFetch(`/api/users/${userId}/2fa/reset`, { method: "POST" }),
    onSuccess: () => {
      toast.success(
        ar
          ? "تم إلغاء التحقق بخطوتين للمستخدم وتسجيل خروجه"
          : "Two-step verification reset and the user signed out",
      );
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["sessions", userId] });
    },
    onError: () => toast.error(ar ? "تعذر الإلغاء" : "Reset failed"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#C9A24D]" />
          {ar ? "التحقق بخطوتين" : "Two-step verification"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "لو المستخدم ضيّع موبايله، الغي التحقق بخطوتين وهو يعمله تاني بعد ما يدخل."
            : "If the user lost their phone, reset it; they set it up again after signing in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 flex-wrap">
        {isLoading || !data ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : data.enabled ? (
          <>
            <div className="text-sm flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                {ar ? "مفعّل" : "On"}
              </Badge>
              {data.enabledAt && (
                <span className="text-muted-foreground">
                  {ar ? "من" : "since"} {formatDate(data.enabledAt)}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={reset.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    ar
                      ? "إلغاء التحقق بخطوتين لهذا المستخدم وتسجيل خروجه من كل الأجهزة؟"
                      : "Reset this user's two-step verification and sign them out everywhere?",
                  )
                )
                  reset.mutate();
              }}
            >
              {ar ? "إلغاء (ضاع الموبايل)" : "Reset (lost phone)"}
            </Button>
          </>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {ar ? "غير مفعّل" : "Off"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
