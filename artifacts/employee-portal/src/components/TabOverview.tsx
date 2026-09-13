import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  Calendar,
  Home,
  QrCode,
  UtensilsCrossed,
  Bus,
  Clock,
  Sparkles,
  FileText,
  Wrench,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Key,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ResidentQRCode } from "./ResidentQRCode";
import { cn } from "../lib/utils";

interface Props {
  employee: any;
  portalData: any;
  onRequestTab: () => void;
  onActivitiesTab: () => void;
  onEvaluationsTab: () => void;
  onDocTab: () => void;
  onProfileTab: () => void;
  onRoommatesTab: () => void;
  onHR: () => void;
}

function getTimeGreeting(isRtl: boolean): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return isRtl ? "صباح الخير" : "Good Morning";
  }
  if (hour >= 12 && hour < 17) {
    return isRtl ? "مساء الخير" : "Good Afternoon";
  }
  return isRtl ? "مساء الخير" : "Good Evening";
}

export default function TabOverview({
  employee,
  portalData,
  onRequestTab,
  onActivitiesTab,
  onDocTab,
  onProfileTab,
  onRoommatesTab,
  onHR,
}: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const room = portalData?.room as
    | { roomNumber?: string; building?: string; bedLabel?: string }
    | undefined;
  const assignments = portalData?.assignments || [];
  const firstName =
    employee?.fullName?.split(" ")[0] ||
    employee?.firstName ||
    (isRtl ? "موظف" : "Employee");

  const [greeting, setGreeting] = useState(() => getTimeGreeting(isRtl));
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    setGreeting(getTimeGreeting(isRtl));
    const timer = setInterval(() => {
      setGreeting(getTimeGreeting(isRtl));
    }, 30000);
    return () => clearInterval(timer);
  }, [isRtl]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [roommates, setRoommates] = useState<any[]>([]);

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        const [notifRes, docRes, roomRes] = await Promise.all([
          apiFetch("/api/portal-notifications/my", { credentials: "include" }),
          apiFetch("/api/portal-data/documents", { credentials: "include" }),
          apiFetch("/api/portal-data/roommates", { credentials: "include" }),
        ]);

        if (notifRes.ok) {
          const notifData = await notifRes.json().catch(() => null);
          if (notifData?.success) {
            setNotifications((notifData.notifications || []).slice(0, 3));
          }
        }

        if (docRes.ok) {
          const docData = await docRes.json().catch(() => null);
          if (docData?.success) {
            setDocCount((docData.documents || []).length);
          }
        }

        if (roomRes.ok) {
          const roomData = await roomRes.json().catch(() => null);
          if (roomData?.roommates) {
            setRoommates(roomData.roommates);
          }
        }

        const upcomingEvents =
          portalData?.events?.length ?? portalData?.upcomingEvents?.length ?? 0;
        setEventCount(typeof upcomingEvents === "number" ? upcomingEvents : 0);
      } catch {}
    };

    loadOverviewData();
  }, [portalData?.events, portalData?.upcomingEvents]);

  const pendingRequestsCount =
    assignments.filter(
      (a: any) => a.status === "ACTIVE" || a.status === "PENDING",
    ).length || 0;

  const isAssigned = Boolean(room?.roomNumber);
  const staffCode = employee?.employeeId || employee?.profileId || "EMP-203";

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      {/* ── 1. DIGITAL RESIDENT WALLET PASS (Apple Wallet / Luxury Fintech Style) ── */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#121E36] via-[#1A2B4C] to-[#20365D] text-white p-5 shadow-2xl border border-white/10">
        {/* Ambient background glows */}
        <div className="absolute -end-10 -top-10 w-44 h-44 bg-[#C9A24D] opacity-[0.12] blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -start-10 -bottom-10 w-36 h-36 bg-blue-500 opacity-[0.08] blur-[70px] rounded-full pointer-events-none" />

        {/* Pass Top Bar */}
        <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-[#E0C070]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#E0C070]">
                SUNRISE RESIDENT PASS
              </span>
              <div className="text-[11px] font-mono text-white/60">
                ID: {staffCode}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white backdrop-blur-md transition-all cursor-pointer shadow-xs active:scale-95"
            title={isRtl ? "إظهار رمز QR السكني" : "Show Resident QR"}
          >
            <QrCode className="w-3.5 h-3.5 text-[#E0C070]" />
            <span>{isRtl ? "رمز الدخول" : "Gate QR"}</span>
          </button>
        </div>

        {/* Resident Identity */}
        <div className="relative z-10 mb-4">
          <div className="text-xs text-white/70 font-medium">
            {greeting},{" "}
            <span className="text-white font-semibold">
              {employee?.department || "Hospitality"}
            </span>
          </div>
          <h2
            className="text-2xl font-black text-white tracking-tight mt-0.5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {employee?.fullName || firstName}
          </h2>
          {employee?.jobTitle && (
            <p className="text-xs text-[#E0C070]/90 font-medium mt-0.5">
              {employee.jobTitle}
            </p>
          )}
        </div>

        {/* Room & Bed Allocation Pill Card */}
        <div className="relative z-10 rounded-2xl bg-black/25 border border-white/10 p-3.5 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                isAssigned
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30",
              )}
            >
              <Home className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                {isRtl ? "مقر السكن المخصص" : "Assigned Housing"}
              </div>
              <div className="text-sm font-bold text-white truncate">
                {isAssigned && room ? (
                  <>
                    <span>{isRtl ? "غرفة " : "Room "}</span>
                    <span className="text-[#E0C070] font-mono">
                      {room.roomNumber}
                    </span>
                    {room.building && (
                      <span className="text-white/75 font-normal text-xs">
                        {" "}
                        · {room.building}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-300 font-medium">
                    {isRtl ? "قيد التسكين والاعتماد" : "Pending Bed Allocation"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-end">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono",
                isAssigned
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isAssigned ? "bg-emerald-400 animate-pulse" : "bg-amber-400",
                )}
              />
              {isAssigned
                ? isRtl
                  ? "مُسكّن نشط"
                  : "Active"
                : isRtl
                  ? "قيد الانتظار"
                  : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. DAILY PULSE WIDGET (Today's Meal, Shuttle Bus & Roommates) ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Dining Card */}
        <div className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-2xs hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {isRtl ? "مطعم السكن" : "Dining"}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              {isRtl ? "وجبة اليوم القادمة" : "Upcoming Meal"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "بوفيه العاملين مفتوح الآن" : "Staff buffet active"}
            </p>
          </div>
        </div>

        {/* Shuttle Bus Card */}
        <div className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-2xs hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
              {isRtl ? "باص الفندق" : "Shuttle"}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              {isRtl ? "مواعيد الأتوبيس" : "Next Departure"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "كل 30 دقيقة للفنادق" : "Every 30 mins to resort"}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. EXECUTIVE STAT CARDS ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Documents */}
        <button
          type="button"
          onClick={onDocTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-cyan-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl flex items-center justify-center mb-2">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {docCount}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "المستندات" : "Documents"}
            </div>
          </div>
        </button>

        {/* Requests */}
        <button
          type="button"
          onClick={onRequestTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-amber-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-2">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {pendingRequestsCount}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "الطلبات" : "Requests"}
            </div>
          </div>
        </button>

        {/* Roommates / Community */}
        <button
          type="button"
          onClick={onRoommatesTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-purple-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-2">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {roommates.length}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "زملاء السكن" : "Roommates"}
            </div>
          </div>
        </button>
      </div>

      {/* ── 4. HR SUPPORT CHAT BANNER ── */}
      <button
        type="button"
        onClick={onHR}
        className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/5 border border-amber-500/30 p-4 flex items-center justify-between gap-3 text-start transition-all hover:border-amber-500/50 hover:shadow-sm cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground truncate">
              {isRtl ? "محادثة الموارد البشرية وإدارة السكن" : "HR & Housing Support Chat"}
            </h4>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {isRtl
                ? "تواصل مباشر وفوري مع فريق الإشراف والمتابعة"
                : "Instant direct assistance from the housing coordinators"}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
          <span>{isRtl ? "تواصل" : "Connect"}</span>
          <Chevron className="w-3.5 h-3.5" />
        </div>
      </button>

      {/* ── 5. RECENT NOTIFICATIONS & ANNOUNCEMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            {isRtl ? "أحدث التنبيهات والفعاليات" : "Recent Alerts & Events"}
          </h3>
        </div>

        <div className="space-y-2">
          {notifications.length > 0 ? (
            notifications.map((notif, idx) => (
              <div
                key={notif.id || idx}
                className="p-3 rounded-2xl bg-card/75 border border-border/60 flex items-start gap-3 shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">
                    {notif.title || (isRtl ? "إشعار جديد" : "New Notice")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {notif.message || notif.body}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-2xl bg-card/50 border border-dashed border-border/60 text-center text-xs text-muted-foreground">
              {isRtl
                ? "لا توجد تنبيهات جديدة اليوم. يومك سعيد!"
                : "No new notifications today. Have a great day!"}
            </div>
          )}
        </div>
      </div>

      {/* ── QR CODE FULL MODAL DIALOG ── */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-xs bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#1A2B4C] text-[#E0C070] flex items-center justify-center border border-white/10 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">
                {employee?.fullName || firstName}
              </h3>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {staffCode} · {isAssigned ? `Room ${room?.roomNumber}` : "Staff Pass"}
              </p>
            </div>

            {/* Crisp QR Code */}
            <ResidentQRCode
              data={`SUNRISE_RESIDENT:${staffCode}:${room?.roomNumber || "NONE"}:${employee?.fullName || "STAFF"}`}
              size={180}
              className="border-4 border-muted"
            />

            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[220px]">
              {isRtl
                ? "استخدم هذا الرمز للمرور عبر بوابات السكن ودخول مطعم العاملين"
                : "Scan this pass for security gate entry and cafeteria meals"}
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {isRtl ? "إغلاق" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
