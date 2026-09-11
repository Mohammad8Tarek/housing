import {
  ShieldCheck,
  User,
  MapPin,
  Clock,
  ListTodo,
  Info,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Building2,
  TrendingUp,
  CheckCircle,
  Users,
  Calendar,
  Star,
  Home,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";

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
  onEvaluationsTab,
  onDocTab,
  onProfileTab,
  onRoommatesTab,
  onHR,
}: Props) {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  const room = portalData?.room as
    | { roomNumber?: string; building?: string }
    | undefined;
  const assignments = portalData?.assignments || [];
  const firstName = employee?.fullName?.split(" ")[0] || employee?.firstName || (isRtl ? "موظف" : "Employee");
  const empAddress = (employee?.address as string | undefined) || "";

  const [greeting, setGreeting] = useState(() => getTimeGreeting(isRtl));

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
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadOverviewData = async () => {
      setLoadingState("loading");
      setStatusMessage(null);
      try {
        const [notifRes, docRes] = await Promise.all([
          apiFetch("/api/portal-notifications/my", { credentials: "include" }),
          apiFetch("/api/portal-data/documents", { credentials: "include" }),
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

        const upcomingEvents =
          portalData?.events?.length ?? portalData?.upcomingEvents?.length ?? 0;
        setEventCount(typeof upcomingEvents === "number" ? upcomingEvents : 0);
        setLoadingState("ready");
      } catch {
        setLoadingState("error");
        setStatusMessage(
          isRtl
            ? "تعذر تحميل بعض المحتويات مؤقتًا."
            : "Some content could not be loaded right now.",
        );
      }
    };

    loadOverviewData();
  }, [portalData?.events, portalData?.upcomingEvents, isRtl]);

  const pendingCount =
    assignments.filter(
      (a: any) => a.status === "ACTIVE" || a.status === "PENDING",
    ).length || 0;

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A2B4C] to-[#243856] p-5 shadow-xl">
        <div className="absolute -end-8 -top-8 w-40 h-40 bg-[#C9A24D] opacity-[0.06] blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -start-4 -bottom-4 w-32 h-32 bg-white opacity-[0.03] blur-[60px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-[0.12em] mb-3">
            <ShieldCheck className="w-3 h-3" />
            {isRtl ? "البوابة الداخلية" : "Internal Portal"}
          </div>
          <h2
            className="text-xl font-bold text-white mb-1 leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {greeting},{" "}
            <span className="text-[#E0C070]">{firstName}</span>
          </h2>
          <p className="text-white/60 text-[12px] max-w-xs leading-relaxed">
            {isRtl
              ? "مرحباً بك في بوابة الإدارة الفندقية. كل ما تحتاجه بين يديك."
              : "Welcome to your luxury concierge for workplace management. Everything you need is at your fingertips."}
          </p>
        </div>
      </div>

      {/* Room Info Card */}
      {room && (
        <div className="rounded-2xl bg-card border border-border2 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center flex-shrink-0">
              <Home className="w-5 h-5 text-accent2" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted2 font-medium uppercase tracking-wide">
                {isRtl ? "السكن" : "Accommodation"}
              </div>
              <div className="text-[15px] font-bold text-foreground mt-0.5 leading-tight">
                {isRtl ? "غرفة رقم" : "Room"}{" "}
                <span className="text-accent2">{room.roomNumber}</span>
              </div>
              {room.building && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted2" />
                  <span className="text-[12px] text-muted2">
                    {room.building}
                  </span>
                </div>
              )}
              {empAddress && (
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-muted2" />
                  <span className="text-[12px] text-muted2">{empAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resident Dashboard Stat Cards - Executive Tremor Style */}
      <div className="grid grid-cols-3 gap-2.5">
        <div
          onClick={onDocTab}
          className="bg-card/85 backdrop-blur-md border border-border2/80 rounded-2xl p-3 card-hover cursor-pointer relative overflow-hidden group shadow-xs hover:border-blue-500/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
              <MaterialIcon
                icon="description"
                size={18}
                className="text-blue-500 dark:text-blue-400"
              />
            </div>
            {/* Mini SVG sparkline */}
            <svg width="36" height="14" className="overflow-visible opacity-60 group-hover:opacity-100 transition-opacity">
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,12 8,10 16,11 24,6 36,3"
              />
            </svg>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-foreground leading-none tracking-tight">
              {docCount}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                +{Math.min(docCount, 2)} {isRtl ? "جديد" : "new"}
              </span>
            </div>
            <div className="text-[10px] text-muted2 mt-1 truncate font-medium">
              {isRtl ? "المستندات" : "Documents"}
            </div>
          </div>
        </div>

        <div
          onClick={onRequestTab}
          className="bg-card/85 backdrop-blur-md border border-border2/80 rounded-2xl p-3 card-hover cursor-pointer relative overflow-hidden group shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
              <MaterialIcon
                icon="pending_actions"
                size={18}
                className="text-amber-500 dark:text-amber-400"
              />
            </div>
            {/* Mini SVG sparkline */}
            <svg width="36" height="14" className="overflow-visible opacity-60 group-hover:opacity-100 transition-opacity">
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,6 10,8 18,5 26,10 36,7"
              />
            </svg>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-foreground leading-none tracking-tight">
              {pendingCount}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {isRtl ? "قيد المتابعة" : "Active"}
              </span>
            </div>
            <div className="text-[10px] text-muted2 mt-1 truncate font-medium">
              {isRtl ? "الطلبات" : "Requests"}
            </div>
          </div>
        </div>

        <div
          onClick={onActivitiesTab}
          className="bg-card/85 backdrop-blur-md border border-border2/80 rounded-2xl p-3 card-hover cursor-pointer relative overflow-hidden group shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <MaterialIcon
                icon="event_available"
                size={18}
                className="text-emerald-500 dark:text-emerald-400"
              />
            </div>
            {/* Mini SVG sparkline */}
            <svg width="36" height="14" className="overflow-visible opacity-60 group-hover:opacity-100 transition-opacity">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,11 10,9 18,10 26,4 36,2"
              />
            </svg>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-foreground leading-none tracking-tight">
              {eventCount}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {isRtl ? "متاح" : "Open"}
              </span>
            </div>
            <div className="text-[10px] text-muted2 mt-1 truncate font-medium">
              {isRtl ? "الفعاليات" : "Activities"}
            </div>
          </div>
        </div>
      </div>

      {/* Contact HR */}
      <button
        onClick={onHR}
        className="relative overflow-hidden w-full rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#B8922E] p-[1px] group"
      >
        <div className="rounded-2xl bg-card p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#C9A24D]/10 flex items-center justify-center flex-shrink-0">
            <MaterialIcon
              icon="support_agent"
              size={24}
              className="text-[#C9A24D]"
            />
          </div>
          <div className="flex-1 text-start">
            <div className="text-sm font-bold text-foreground">
              {isRtl ? "محادثة الموارد البشرية" : "Chat with HR"}
            </div>
            <div className="text-[11px] text-muted2 mt-0.5">
              {isRtl
                ? "تواصل مباشر مع فريق الدعم والموارد البشرية"
                : "Direct line to HR support & personnel team"}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#C9A24D]">
            {isRtl ? "تواصل" : "Contact"}{" "}
            <MaterialIcon
              icon={isRtl ? "chevron_left" : "chevron_right"}
              size={16}
            />
          </div>
        </div>
      </button>

      {/* Quick Actions - Stitch exact */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          {isRtl ? "إجراءات سريعة" : "Quick Actions"}
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={onDocTab}
            className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl bg-card border border-border2 hover:border-accent2/30 hover:bg-accent2/5 transition-all active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center">
              <MaterialIcon
                icon="folder_open"
                size={22}
                className="text-accent2"
              />
            </div>
            <span className="text-[11px] font-semibold text-muted2 text-center leading-tight">
              {isRtl ? "عرض المستندات" : "View Docs"}
            </span>
          </button>
          <button
            onClick={onRequestTab}
            className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl bg-card border border-border2 hover:border-accent2/30 hover:bg-accent2/5 transition-all active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center">
              <MaterialIcon icon="add_box" size={22} className="text-accent2" />
            </div>
            <span className="text-[11px] font-semibold text-muted2 text-center leading-tight">
              {isRtl ? "تقديم طلب" : "Submit Request"}
            </span>
          </button>
          <button
            onClick={onProfileTab}
            className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl bg-card border border-border2 hover:border-accent2/30 hover:bg-accent2/5 transition-all active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center">
              <MaterialIcon
                icon="account_circle"
                size={22}
                className="text-accent2"
              />
            </div>
            <span className="text-[11px] font-semibold text-muted2 text-center leading-tight">
              {isRtl ? "الملف الشخصي" : "Profile"}
            </span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          {statusMessage}
        </div>
      )}

      {/* Latest Alerts - Stitch exact */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            {isRtl ? "أحدث التنبيهات" : "Latest Alerts"}
          </h3>
        </div>
        <div className="space-y-2.5">
          {loadingState === "loading" ? (
            <div className="rounded-xl border border-border2 bg-card px-3 py-4 text-[12px] text-muted2">
              {isRtl ? "جاري التحميل..." : "Loading alerts..."}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border2 bg-card px-3 py-5 text-center text-[12px] text-muted2">
              {isRtl ? "لا توجد تنبيهات." : "No alerts yet."}
            </div>
          ) : (
            notifications.map((item: any, i: number) => {
              const alertIcon =
                i === 0 ? "check_circle" : i === 1 ? "upload_file" : "groups";
              const alertColor =
                i === 0
                  ? "text-green-400"
                  : i === 1
                    ? "text-blue-400"
                    : "text-purple-400";
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border2"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${alertColor.replace("text", "bg")}/10`}
                  >
                    <MaterialIcon
                      icon={alertIcon}
                      size={16}
                      className={alertColor}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground leading-snug">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-muted2 mt-0.5 line-clamp-1">
                      {item.message}
                    </div>
                    <div className="text-[9px] text-muted2 mt-1">
                      {(() => {
                        try {
                          const diff = Math.floor(
                            (Date.now() - new Date(item.createdAt).getTime()) /
                              1000,
                          );
                          if (diff < 3600)
                            return isRtl
                              ? `${Math.floor(diff / 60)} د`
                              : `${Math.floor(diff / 60)}m ago`;
                          if (diff < 86400)
                            return isRtl
                              ? `${Math.floor(diff / 3600)} س`
                              : `${Math.floor(diff / 3600)}h ago`;
                          return new Date(item.createdAt).toLocaleDateString(
                            isRtl ? "ar-SA" : "en-US",
                            { month: "short", day: "numeric" },
                          );
                        } catch {
                          return "";
                        }
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button
          onClick={onDocTab}
          className="w-full mt-3 py-2.5 text-center text-[11px] font-bold text-accent2 hover:text-accent2/80 transition-colors bg-accent2/5 rounded-xl border border-accent2/10"
        >
          {isRtl ? "عرض جميع الإشعارات" : "View All Notifications"}
        </button>
      </div>
    </div>
  );
}
