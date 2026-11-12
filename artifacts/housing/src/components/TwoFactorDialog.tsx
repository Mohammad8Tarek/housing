// Two-step verification for your own account: set up with an authenticator
// app (QR), keep recovery codes, renew them, or turn it off.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-utils";

type Status = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
};

const KEY = ["/api/auth/2fa"];

function CodeInput({
  value,
  onChange,
  placeholder = "123456",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      dir="ltr"
      autoComplete="one-time-code"
      maxLength={20}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 text-center text-lg tracking-[0.3em] font-mono"
    />
  );
}

function RecoveryCodes({ codes, ar }: { codes: string[]; ar: boolean }) {
  const text = codes.join("\n");
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([`Sunrise Housing — recovery codes\n\n${text}\n`], {
        type: "text/plain",
      }),
    );
    a.download = "sunrise-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        {ar
          ? "احفظ الأكواد دي في مكان آمن. كل كود بيشتغل مرة واحدة بس لو الموبايل مش معاك، ومش هتظهر تاني."
          : "Keep these codes somewhere safe. Each works once if you don't have your phone, and they won't be shown again."}
      </div>
      <div
        dir="ltr"
        className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm text-center"
      >
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            navigator.clipboard
              ?.writeText(text)
              .then(() => toast.success(ar ? "تم النسخ" : "Copied"))
          }
        >
          <Copy className="w-4 h-4" />
          {ar ? "نسخ" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={download}
        >
          <Download className="w-4 h-4" />
          {ar ? "تحميل" : "Download"}
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorDialog({
  ar,
  open,
  onOpenChange,
}: {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () => customFetch<Status>("/api/auth/2fa"),
    enabled: open,
  });
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "renew" | "disable">("idle");

  const reset = () => {
    setSetup(null);
    setCode("");
    setPassword("");
    setCodes(null);
    setMode("idle");
  };
  const err = (e: any) =>
    toast.error(
      e?.data?.code === "TWO_FACTOR_INVALID"
        ? ar
          ? "الكود أو كلمة المرور غير صحيحة"
          : "Wrong code or password"
        : ar
          ? "حصلت مشكلة"
          : "Something went wrong",
    );
  const post = <T,>(path: string, body?: unknown) =>
    customFetch<T>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  const start = useMutation({
    mutationFn: () =>
      post<{ qr: string; secret: string }>("/api/auth/2fa/setup"),
    onSuccess: (r) => {
      setSetup(r);
      setCode("");
    },
    onError: err,
  });
  const enable = useMutation({
    mutationFn: () =>
      post<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", {
        code: code.trim(),
      }),
    onSuccess: (r) => {
      setSetup(null);
      setCode("");
      setCodes(r.recoveryCodes);
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(
        ar ? "تم تفعيل التحقق بخطوتين" : "Two-step verification is on",
      );
    },
    onError: err,
  });
  const renew = useMutation({
    mutationFn: () =>
      post<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery-codes", {
        code: code.trim(),
      }),
    onSuccess: (r) => {
      setCode("");
      setMode("idle");
      setCodes(r.recoveryCodes);
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: err,
  });
  const disable = useMutation({
    mutationFn: () =>
      post("/api/auth/2fa/disable", { password, code: code.trim() }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(
        ar ? "تم إيقاف التحقق بخطوتين" : "Two-step verification is off",
      );
    },
    onError: err,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {ar ? "التحقق بخطوتين" : "Two-step verification"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "بعد كلمة المرور هيتطلب كود من تطبيق على موبايلك (Google Authenticator أو Microsoft Authenticator)، فحتى لو حد عرف كلمة المرور ما يقدرش يدخل."
              : "After your password you'll also enter a code from an app on your phone (Google or Microsoft Authenticator), so a stolen password alone can't get in."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !status ? (
          <div className="py-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : codes ? (
          <div className="space-y-3">
            <RecoveryCodes codes={codes} ar={ar} />
            <Button className="w-full" onClick={() => setCodes(null)}>
              {ar ? "حفظتهم" : "I've saved them"}
            </Button>
          </div>
        ) : !status.enabled ? (
          setup ? (
            <div className="space-y-3">
              <ol className="text-sm space-y-1 list-decimal ps-5">
                <li>
                  {ar
                    ? "افتح تطبيق المصادقة على موبايلك وامسح الكود ده."
                    : "Open your authenticator app and scan this code."}
                </li>
                <li>
                  {ar
                    ? "اكتب الكود المكوّن من 6 أرقام اللي ظهر في التطبيق."
                    : "Enter the 6-digit code the app shows."}
                </li>
              </ol>
              <div className="flex justify-center">
                <img
                  src={setup.qr}
                  alt="QR"
                  className="w-44 h-44 rounded-lg border bg-white p-1"
                />
              </div>
              <div className="text-xs text-center text-muted-foreground">
                {ar ? "أو اكتب المفتاح يدوي:" : "Or type the key:"}{" "}
                <span dir="ltr" className="font-mono text-foreground">
                  {setup.secret}
                </span>
              </div>
              <CodeInput value={code} onChange={setCode} />
              <Button
                className="w-full"
                disabled={enable.isPending || code.trim().length < 6}
                onClick={() => enable.mutate()}
              >
                {enable.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                )}
                {ar ? "تفعيل" : "Turn on"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline" className="text-muted-foreground">
                {ar ? "غير مفعّل" : "Off"}
              </Badge>
              <Button
                className="w-full gap-2"
                disabled={start.isPending}
                onClick={() => start.mutate()}
              >
                {start.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {ar ? "إعداد التحقق بخطوتين" : "Set up two-step verification"}
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                {ar ? "مفعّل" : "On"}
              </Badge>
              {status.enabledAt && (
                <span className="text-muted-foreground">
                  {ar ? "من" : "since"} {formatDate(status.enabledAt)}
                </span>
              )}
              <span className="text-muted-foreground">
                ·{" "}
                {ar
                  ? `باقي ${status.recoveryCodesLeft} أكواد استرجاع`
                  : `${status.recoveryCodesLeft} recovery codes left`}
              </span>
            </div>

            {mode === "idle" && (
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => setMode("renew")}>
                  {ar ? "أكواد استرجاع جديدة" : "New recovery codes"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => setMode("disable")}
                >
                  <ShieldOff className="w-4 h-4" />
                  {ar ? "إيقاف التحقق بخطوتين" : "Turn off"}
                </Button>
              </div>
            )}

            {mode !== "idle" && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm">
                  {mode === "renew"
                    ? ar
                      ? "اكتب كود من التطبيق عشان تعمل أكواد جديدة (القديمة هتبطل)."
                      : "Enter a code from the app to create new codes (the old ones stop working)."
                    : ar
                      ? "اكتب كلمة المرور وكود من التطبيق (أو كود استرجاع)."
                      : "Enter your password and a code from the app (or a recovery code)."}
                </div>
                {mode === "disable" && (
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder={ar ? "كلمة المرور" : "Password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
                <CodeInput value={code} onChange={setCode} />
                <div className="flex gap-2">
                  <Button
                    variant={mode === "disable" ? "destructive" : "default"}
                    className="flex-1"
                    disabled={
                      code.trim().length < 6 ||
                      (mode === "disable" && !password) ||
                      renew.isPending ||
                      disable.isPending
                    }
                    onClick={() =>
                      mode === "renew" ? renew.mutate() : disable.mutate()
                    }
                  >
                    {mode === "renew"
                      ? ar
                        ? "إنشاء"
                        : "Create"
                      : ar
                        ? "إيقاف"
                        : "Turn off"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMode("idle");
                      setCode("");
                      setPassword("");
                    }}
                  >
                    {ar ? "إلغاء" : "Cancel"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
