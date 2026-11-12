// Late tickets: open maintenance / housekeeping tickets that passed their
// target time or are about to, with who holds them.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlarmClock, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type SlaState = "overdue" | "due_soon" | "on_track";
type SlaTicket = {
  id: number;
  ticketNo: string;
  category: string;
  serviceAr: string;
  serviceEn: string;
  priority: string;
  location: string;
  technician: string | null;
  minutesLeft: number;
  state: SlaState;
};
type SlaGroup = { key: string; open: number; overdue: number; dueSoon: number };
type SlaWatch = {
  open: number;
  overdue: number;
  dueSoon: number;
  onTrack: number;
  byDepartment: SlaGroup[];
  byTechnician: SlaGroup[];
  tickets: SlaTicket[];
};

const DEPT: Record<string, { ar: string; en: string }> = {
  maintenance: { ar: "الصيانة", en: "Engineering" },
  housekeeping: { ar: "النظافة", en: "Housekeeping" },
  general: { ar: "عام", en: "General" },
};

/** 95 -> "1h 35m" / "1 س 35 د"; 3000 -> "2d 2h" / "2 يوم 2 س". */
export function formatSpan(minutes: number, ar: boolean): string {
  const m = Math.abs(Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  const u = ar ? { d: " يوم", h: " س", m: " د" } : { d: "d", h: "h", m: "m" };
  if (d > 0) return h ? `${d}${u.d} ${h}${u.h}` : `${d}${u.d}`;
  if (h > 0) return min ? `${h}${u.h} ${min}${u.m}` : `${h}${u.h}`;
  return `${min}${u.m}`;
}

export function SlaWatchCard({
  propertyId,
  buildNavHref,
}: {
  propertyId: number;
  buildNavHref: (path: string) => string;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [view, setView] = useState<"tickets" | "technicians" | "departments">(
    "tickets",
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/maintenance/sla-watch", propertyId],
    queryFn: () =>
      customFetch<SlaWatch>(
        `/api/maintenance/sla-watch?propertyId=${propertyId}`,
      ),
    enabled: propertyId > 0,
    refetchInterval: 60_000,
  });

  if (!propertyId || isError) return null;

  const deptLabel = (k: string) =>
    (DEPT[k] ?? { ar: k, en: k })[ar ? "ar" : "en"];
  const groups =
    view === "technicians"
      ? (data?.byTechnician ?? [])
      : view === "departments"
        ? (data?.byDepartment ?? [])
        : [];

  return (
    <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlarmClock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                {ar ? "البلاغات المتأخرة" : "Late tickets"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {ar
                  ? "البلاغات المفتوحة اللي عدّت الوقت المستهدف أو قربت تعدّيه"
                  : "Open tickets past their target time or close to it"}
              </CardDescription>
            </div>
          </div>
          {data && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10">
                {ar ? "متأخر" : "Late"} {data.overdue}
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
                {ar ? "قرّب يتأخر" : "Due soon"} {data.dueSoon}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {ar ? "في الوقت" : "On track"} {data.onTrack}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading || !data ? (
          <div className="py-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" />
          </div>
        ) : data.overdue + data.dueSoon === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            {data.open === 0
              ? ar
                ? "مفيش بلاغات مفتوحة"
                : "No open tickets"
              : ar
                ? `كل البلاغات المفتوحة (${data.open}) في وقتها`
                : `All ${data.open} open tickets are on track`}
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-3 text-xs">
              {(
                [
                  ["tickets", ar ? "البلاغات" : "Tickets"],
                  ["technicians", ar ? "حسب الفني" : "By technician"],
                  ["departments", ar ? "حسب القسم" : "By department"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${view === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "tickets" ? (
              <ul className="divide-y rounded-xl border">
                {data.tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={buildNavHref(`/maintenance/${t.id}`)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <span
                        className={`w-1.5 self-stretch rounded-full shrink-0 ${t.state === "overdue" ? "bg-rose-500" : "bg-amber-500"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {t.ticketNo}
                          </span>
                          <span className="font-semibold truncate">
                            {ar ? t.serviceAr : t.serviceEn}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.location} · {deptLabel(t.category)} ·{" "}
                          {t.technician ?? (ar ? "بدون فني" : "Unassigned")}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums shrink-0 ${t.state === "overdue" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}
                      >
                        {t.state === "overdue"
                          ? ar
                            ? `متأخر ${formatSpan(t.minutesLeft, ar)}`
                            : `${formatSpan(t.minutesLeft, ar)} late`
                          : ar
                            ? `باقي ${formatSpan(t.minutesLeft, ar)}`
                            : `${formatSpan(t.minutesLeft, ar)} left`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border divide-y">
                {groups.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    {ar
                      ? "مفيش بلاغات متعيّنة لفنيين"
                      : "No tickets assigned to technicians"}
                  </div>
                )}
                {groups.map((g) => (
                  <div
                    key={g.key}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold flex-1 truncate">
                      {view === "departments" ? deptLabel(g.key) : g.key}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ar ? "مفتوح" : "Open"} {g.open}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        g.overdue
                          ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                          : "text-muted-foreground"
                      }
                    >
                      {ar ? "متأخر" : "Late"} {g.overdue}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        g.dueSoon
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground"
                      }
                    >
                      {ar ? "قرّب" : "Soon"} {g.dueSoon}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <Link
              href={buildNavHref("/maintenance")}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {ar ? "كل البلاغات" : "All tickets"}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
