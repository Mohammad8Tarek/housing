// Signed-in devices of one account. Used for your own account (user menu →
// "My devices") and by admins on a user's page (Security tab).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-utils";

export type SessionInfo = {
  id: string;
  current: boolean;
  ip: string | null;
  device: string;
  loginAt: string | null;
  lastSeenAt: string | null;
};

/** "5 min ago" / "منذ 5 د". */
function ago(iso: string | null, ar: boolean): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 2) return ar ? "نشط الآن" : "Active now";
  if (min < 60) return ar ? `منذ ${min} د` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return ar ? `منذ ${h} س` : `${h} h ago`;
  return formatDate(iso);
}

const time = (iso: string | null) =>
  iso
    ? `${formatDate(iso)} ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "—";

export function SessionsList({
  ar,
  /** null = your own sessions; a number = that user's (admin). */
  userId,
}: {
  ar: boolean;
  userId: number | null;
}) {
  const qc = useQueryClient();
  const base = userId ? `/api/users/${userId}/sessions` : "/api/auth/sessions";
  const key = ["sessions", userId ?? "me"];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => customFetch<{ data: SessionInfo[] }>(base),
  });
  const sessions = data?.data ?? [];
  const others = sessions.filter((s) => !s.current);

  const endOne = useMutation({
    mutationFn: (sid: string) =>
      customFetch(`${base}/${sid}/end`, { method: "POST" }),
    onSuccess: () => {
      toast.success(ar ? "تم تسجيل خروج الجهاز" : "Device signed out");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () =>
      toast.error(ar ? "تعذر إنهاء الجلسة" : "Could not end session"),
  });
  const endAll = useMutation({
    mutationFn: () =>
      customFetch<{ ended: number }>(
        userId ? `${base}/end-all` : `${base}/end-others`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      toast.success(
        ar
          ? `تم تسجيل الخروج من ${r.ended} جهاز`
          : `Signed out of ${r.ended} device(s)`,
      );
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error(ar ? "تعذر تسجيل الخروج" : "Sign-out failed"),
  });

  if (isLoading) {
    return (
      <div className="py-6 text-center">
        <Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        {ar ? "تعذر تحميل الأجهزة" : "Could not load devices"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {ar ? "مفيش أجهزة مسجّل دخول منها" : "Not signed in on any device"}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {sessions.map((s) => {
            const mobile = /iPhone|iPad|Android|App/.test(s.device);
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{s.device}</span>
                    {s.current && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-[10px]">
                        {ar ? "الجهاز الحالي" : "This device"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[
                      s.ip,
                      `${ar ? "دخول" : "Signed in"} ${time(s.loginAt)}`,
                      ago(s.lastSeenAt, ar),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-destructive hover:text-destructive shrink-0"
                    disabled={endOne.isPending}
                    onClick={() => endOne.mutate(s.id)}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {ar ? "خروج" : "Sign out"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(userId ? sessions.length > 0 : others.length > 0) && (
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive hover:text-destructive"
          disabled={endAll.isPending}
          onClick={() => endAll.mutate()}
        >
          {endAll.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {userId
            ? ar
              ? "تسجيل خروج من كل الأجهزة"
              : "Sign out everywhere"
            : ar
              ? "تسجيل خروج من كل الأجهزة التانية"
              : "Sign out all other devices"}
        </Button>
      )}
    </div>
  );
}
