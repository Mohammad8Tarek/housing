/**
 * TabMyRoom — the resident's accommodation at a glance: room, bed, building,
 * floor, occupancy, room status, stay dates and roommates. Reads from the
 * shared cache (/my-room + /roommates) so it opens instantly and offline.
 */
import {
  BedDouble,
  Building2,
  Layers,
  Users,
  CalendarDays,
  CalendarClock,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { formatDMY } from "@workspace/dates";
import { useTheme } from "../lib/theme";
import { useMyRoom, useRoommates } from "../lib/portal-queries";
import { SkeletonCard } from "./SkeletonLoader";

interface Props {
  onRequestTab: () => void;
  onRoommatesTab: () => void;
}

const ROOM_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  available: { ar: "جاهزة", en: "Ready", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  occupied: { ar: "مشغولة", en: "Occupied", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  occupied_vacation: { ar: "مشغولة · إجازة", en: "Occupied · On leave", cls: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
  dirty: { ar: "بانتظار التنظيف", en: "Awaiting cleaning", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  occupied_dirty: { ar: "بانتظار التنظيف", en: "Awaiting cleaning", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  in_cleaning: { ar: "جاري التنظيف", en: "Being cleaned", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  inspected: { ar: "تم التفتيش", en: "Inspected", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  out_of_service: { ar: "خارج الخدمة", en: "Out of service", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  out_of_order: { ar: "عطل", en: "Out of order", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
};

function nightsSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border border-border2 rounded-2xl p-3.5 flex items-start gap-3 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-accent2/10 text-accent2 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted2">{label}</div>
        <div className="text-sm font-bold text-foreground truncate">{value}</div>
        {sub && <div className="text-[11px] text-muted2 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function TabMyRoom({ onRequestTab, onRoommatesTab }: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const roomQuery = useMyRoom();
  const roommatesQuery = useRoommates();

  const data = roomQuery.data;
  const room = (data?.room ?? null) as Record<string, any> | null;
  const roommates = roommatesQuery.data?.roommates ?? [];
  const isLoading = roomQuery.isLoading && !roomQuery.data;

  const refresh = () => {
    roomQuery.refetch();
    roommatesQuery.refetch();
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!data?.assigned || !room) {
    return (
      <div className="px-4 pt-4 pb-6 space-y-4">
        <Header isRtl={isRtl} onRefresh={refresh} refreshing={roomQuery.isFetching} />
        <div className="bg-card border border-border2 rounded-3xl p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <BedDouble className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {isRtl ? "لم يتم تخصيص غرفة بعد" : "No room assigned yet"}
          </h3>
          <p className="text-[12px] text-muted2 leading-relaxed">
            {isRtl
              ? "طلب تسكينك قيد المراجعة. هيوصلك إشعار فور اعتماد الغرفة والسرير."
              : "Your accommodation request is being processed. You will be notified as soon as a bed is allocated."}
          </p>
        </div>
      </div>
    );
  }

  const status = ROOM_STATUS[String(room.status || "").toLowerCase()];
  const capacity = Number(room.capacity || 0);
  const occupancy = Number(room.currentOccupancy || 0);
  const nights = nightsSince(room.checkInDate);
  const building = room.building as { name?: string; location?: string } | null;
  const floor = room.floor as { floorNumber?: string; description?: string } | null;

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <Header isRtl={isRtl} onRefresh={refresh} refreshing={roomQuery.isFetching} />

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border border-white/10 shadow-lg">
        <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-[#E0C070]/10 blur-2xl" />
        <div className="flex items-start justify-between gap-3 relative">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E0C070]">
              {room.property?.name || (isRtl ? "سكن الموظفين" : "Staff Housing")}
            </div>
            <div className="mt-1 text-3xl font-black font-mono tracking-tight">
              <span className="text-white/60 text-base font-bold me-2">{isRtl ? "غرفة" : "Room"}</span>
              {room.roomNumber}
            </div>
            <div className="text-xs text-white/70 mt-1 truncate">
              {[building?.name, floor?.floorNumber ? `${isRtl ? "الدور" : "Floor"} ${floor.floorNumber}` : null, room.roomType]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          {status && (
            <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.cls}`}>
              {isRtl ? status.ar : status.en}
            </span>
          )}
        </div>
        {room.bedNumber && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold">
            <BedDouble className="w-4 h-4 text-[#E0C070]" />
            {isRtl ? `سرير رقم ${room.bedNumber}` : `Bed ${room.bedNumber}`}
          </div>
        )}
      </div>

      {/* Facts */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Building2 className="w-4 h-4" />}
          label={isRtl ? "المبنى" : "Building"}
          value={building?.name || "—"}
          sub={building?.location || undefined}
        />
        <Stat
          icon={<Layers className="w-4 h-4" />}
          label={isRtl ? "الدور" : "Floor"}
          value={floor?.floorNumber || "—"}
          sub={floor?.description || undefined}
        />
        <Stat
          icon={<Users className="w-4 h-4" />}
          label={isRtl ? "الإشغال" : "Occupancy"}
          value={capacity ? `${occupancy} / ${capacity}` : String(occupancy)}
          sub={isRtl ? `${Math.max(0, capacity - occupancy)} سرير شاغر` : `${Math.max(0, capacity - occupancy)} free bed(s)`}
        />
        <Stat
          icon={<CalendarDays className="w-4 h-4" />}
          label={isRtl ? "تاريخ التسكين" : "Check-in"}
          value={room.checkInDate ? formatDMY(room.checkInDate, "—") : "—"}
          sub={nights !== null ? (isRtl ? `${nights} ليلة` : `${nights} night(s)`) : undefined}
        />
        {room.expectedCheckOutDate && (
          <Stat
            icon={<CalendarClock className="w-4 h-4" />}
            label={isRtl ? "المغادرة المتوقعة" : "Expected check-out"}
            value={formatDMY(room.expectedCheckOutDate, "—")}
          />
        )}
      </div>

      {/* Roommates */}
      <button
        onClick={onRoommatesTab}
        className="w-full bg-card border border-border2 rounded-2xl p-4 flex items-center gap-3 text-start hover:bg-muted2/10 transition-colors"
        aria-label={isRtl ? "عرض زملاء الغرفة" : "View roommates"}
      >
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">{isRtl ? "زملاء الغرفة" : "Roommates"}</div>
          <div className="text-[11px] text-muted2 truncate">
            {roommates.length === 0
              ? isRtl
                ? "لا يوجد زملاء حالياً"
                : "No roommates right now"
              : roommates
                  .slice(0, 3)
                  .map((r: any) => `${r.firstName || ""} ${r.lastName || ""}`.trim())
                  .join(" · ") + (roommates.length > 3 ? ` +${roommates.length - 3}` : "")}
          </div>
        </div>
        <Chevron className="w-4 h-4 text-muted2 shrink-0" />
      </button>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onRequestTab}
          className="bg-card border border-border2 rounded-2xl p-4 flex flex-col items-start gap-2 text-start hover:bg-muted2/10 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-foreground">{isRtl ? "بلّغ عن عطل بالغرفة" : "Report a room issue"}</div>
          <div className="text-[10px] text-muted2">{isRtl ? "صيانة أو نظافة" : "Maintenance or cleaning"}</div>
        </button>
        <div className="bg-card border border-border2 rounded-2xl p-4 flex flex-col items-start gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-foreground">{isRtl ? "حالة النظافة" : "Housekeeping"}</div>
          <div className="text-[10px] text-muted2">
            {status ? (isRtl ? status.ar : status.en) : isRtl ? "غير معروفة" : "Unknown"}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted2 px-1">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {isRtl
            ? "تغيير الغرفة أو السرير يتم من خلال إدارة السكن. تواصل معهم من صفحة الإعدادات."
            : "Room or bed changes are handled by Housing. Reach them from the Settings tab."}
        </span>
      </div>
    </div>
  );
}

function Header({ isRtl, onRefresh, refreshing }: { isRtl: boolean; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          {isRtl ? "غرفتي" : "My Room"}
        </h2>
        <p className="text-muted2 text-xs mt-0.5">
          {isRtl ? "تفاصيل سكنك الحالي" : "Your current accommodation"}
        </p>
      </div>
      <button
        onClick={onRefresh}
        aria-label={isRtl ? "تحديث" : "Refresh"}
        className="p-2 rounded-xl bg-card border border-border2 text-muted2 hover:text-foreground transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
