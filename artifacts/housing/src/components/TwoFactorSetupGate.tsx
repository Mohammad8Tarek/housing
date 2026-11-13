// Shown instead of the app when the property requires two-step verification
// for the signed-in user's role and they haven't set it up yet. The server
// refuses every other request until they do, so there is nothing else to show.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { TwoFactorDialog } from "@/components/TwoFactorDialog";

export function TwoFactorSetupGate({
  ar,
  onLogout,
}: {
  ar: boolean;
  onLogout: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center bg-background p-6"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold">
          {ar
            ? "لازم تفعّل التحقق بخطوتين الأول"
            : "Two-step verification is required"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "حسابك من الحسابات اللي السياسة بتلزمها بالتحقق بخطوتين. فعّله بتطبيق المصادقة على موبايلك وبعدها هتدخل عادي."
            : "Your role must use two-step verification. Set it up with the authenticator app on your phone and you'll be in."}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setOpen(true)}>
            {ar ? "إعداد التحقق بخطوتين" : "Set up now"}
          </Button>
          <Button variant="ghost" className="gap-2" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
            {ar ? "تسجيل الخروج" : "Sign out"}
          </Button>
        </div>
      </div>
      <TwoFactorDialog
        ar={ar}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Once enabled, /auth/me no longer reports mfaSetupRequired.
          if (!o) qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }}
      />
    </div>
  );
}
