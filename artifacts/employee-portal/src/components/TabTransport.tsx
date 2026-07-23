import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";

interface Schedule {
  id: number;
  route: string;
  routeAr: string | null;
  location: string | null;
  locationAr: string | null;
  departure: string;
  arrival: string | null;
  days: string;
  capacity: number;
  notes: string | null;
  notesAr: string | null;
}

interface Booking {
  id: number;
  scheduleId: number;
  bookingDate: string;
  status: string;
}

export default function TabTransport() {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingDate, setBookingDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"schedules" | "bookings">("schedules");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/portal-food/schedules", {
        credentials: "include",
      }).then((r) => r.json()),
      apiFetch("/api/portal-food/my-bookings", {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([schedData, bookData]) => {
        if (schedData.success) setSchedules(schedData.schedules || []);
        if (bookData.success) setBookings(bookData.bookings || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBook = async () => {
    if (!selected) return;
    setStatus("loading");
    try {
      const res = await apiFetch("/api/portal-food/book", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: selected.id, bookingDate }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed");
      setStatus("success");
      setMsg(isRtl ? "تم الحجز!" : "Booked!");
      setSelected(null);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: any) {
      setStatus("error");
      setMsg(err.message);
    }
  };

  const dayLabels: Record<string, string> = {
    daily: isRtl ? "يومياً" : "Daily",
    weekdays: isRtl ? "أيام العمل" : "Weekdays",
    weekends: isRtl ? "نهاية الأسبوع" : "Weekends",
    custom: isRtl ? "مخصص" : "Custom",
  };

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {isRtl ? "خدمات النقل" : "Transport Services"}
        </h2>
      </div>

      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border2">
        
        
      </div>

      {status === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-xl text-green-400 text-[12px]">
          <CheckCircle2 className="w-4 h-4" />
          {msg}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-[12px]">
          <AlertCircle className="w-4 h-4" />
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
        </div>
      ) : tab === "schedules" ? (
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="bg-card border border-border2 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MaterialIcon
                  icon="directions_bus"
                  size={24}
                  className="text-muted2 opacity-40"
                />
              </div>
              <p className="text-[13px] text-muted2 font-medium">
                {isRtl ? "لا توجد مواعيد" : "No schedules available"}
              </p>
            </div>
          ) : (
            schedules.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  selected?.id === s.id
                    ? "bg-accent2/10 border-accent2/40 shadow-sm"
                    : "bg-surface border-border2 hover:bg-surface-hover hover:border-accent2/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent2/10 flex items-center justify-center text-accent2">
                    <MaterialIcon icon="directions_bus" size={16} />
                  </div>
                  <div className="text-start">
                    <div className="font-semibold text-[13px] text-foreground">
                      {isRtl && (s as any).routeAr ? (s as any).routeAr : s.route}
                    </div>
                    <div className="text-[11px] text-muted2 mt-0.5 flex items-center gap-1.5">
                      <MaterialIcon icon="schedule" size={12} />
                      {(s as any).departure}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-accent2">
                    {(s as any).capacity} {isRtl ? "مقاعد" : "seats"}
                  </div>
                  {(s as any).requiresBooking && (
                    <div className="text-[10px] text-muted2 bg-surface-hover px-1.5 rounded-sm mt-1">
                      {isRtl ? "طلب حجز" : "Booking Req."}
                    </div>
                  )}
                </div>
              </button>            ))
          )}

          {selected && (
            <div className="bg-card border border-accent2/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  {isRtl ? "تأكيد الحجز" : "Confirm Booking"}
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 text-muted2 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[12px] text-muted2">
                <span className="font-bold text-foreground">
                  {isRtl && selected.routeAr
                    ? selected.routeAr
                    : selected.route}
                </span>
                {" · "}
                {selected.departure}
                {selected.arrival ? ` → ${selected.arrival}` : ""}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
                  {isRtl ? "تاريخ الحجز" : "Booking Date"}
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[12px] focus:outline-none focus:border-accent2/50"
                />
              </div>
              <button
                onClick={handleBook}
                disabled={status === "loading"}
                className="w-full py-2.5 rounded-xl bg-accent2 text-accent2-foreground text-[12px] font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MaterialIcon icon="confirmation_number" size={16} />
                )}
                {isRtl ? "تأكيد الحجز" : "Confirm Booking"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {bookings.length === 0 ? (
            <div className="bg-card border border-border2 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MaterialIcon
                  icon="confirmation_number"
                  size={24}
                  className="text-muted2 opacity-40"
                />
              </div>
              <p className="text-[13px] text-muted2 font-medium">
                {isRtl ? "لا توجد حجوزات" : "No bookings yet"}
              </p>
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="bg-card border border-border2 rounded-xl p-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-foreground">
                    {isRtl ? `حجز #${b.id}` : `Booking #${b.id}`}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.status === "cancelled"
                        ? "bg-red-400/10 text-red-400"
                        : b.status === "boarded"
                          ? "bg-green-400/10 text-green-400"
                          : "bg-accent2/10 text-accent2"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted2 mt-1">
                  {b.bookingDate}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
