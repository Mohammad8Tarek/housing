import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "../lib/theme";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";

interface Notification {
  id: number;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  type: string;
  priority: string;
  createdAt: string;
  isRead: boolean;
}

interface Props {
  onChangeTab?: (tab: string, forceRefresh?: boolean) => void;
}

function groupByDate(notifications: Notification[], isRtl: boolean) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const lastWeek: Notification[] = [];
  const older: Notification[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (d >= todayStart) today.push(n);
    else if (d >= yesterdayStart) yesterday.push(n);
    else if (d >= weekAgo) lastWeek.push(n);
    else older.push(n);
  }

  const groups: { label: string; items: Notification[] }[] = [];
  if (today.length)
    groups.push({ label: isRtl ? "اليوم" : "Today", items: today });
  if (yesterday.length)
    groups.push({ label: isRtl ? "أمس" : "Yesterday", items: yesterday });
  if (lastWeek.length)
    groups.push({
      label: isRtl ? "الأسبوع الماضي" : "Last Week",
      items: lastWeek,
    });
  if (older.length)
    groups.push({ label: isRtl ? "سابق" : "Earlier", items: older });
  return groups;
}

const ICONS: Record<string, string> = {
  payroll: "payments",
  schedule: "schedule",
  document: "verified_user",
  announcement: "campaign",
  security: "security",
  activity: "event",
  evaluation: "star",
};

export default function TabNotifications({ onChangeTab }: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const push = usePushNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/portal-notifications/my", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await apiFetch(`/api/portal-notifications/read/${id}`, {
        method: "PUT",
        credentials: "include",
      });
      window.dispatchEvent(new Event("refresh_notifications"));
    } catch {
      /* silent */
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch("/api/portal-notifications/read-all", {
        method: "PUT",
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("refresh_notifications"));
    } catch {
      /* silent */
    } finally {
      setMarkingAll(false);
    }
  };

  const groups = groupByDate(notifications, isRtl);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* Header */}
      <div>
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {isRtl ? "مركز الإشعارات" : "Notifications Center"}
        </h2>
        <p className="text-[11px] text-muted2 mt-0.5">
          {isRtl
            ? "تابع آخر التحديثات والإعلانات"
            : "Stay updated with your latest alerts and announcements."}
        </p>
      </div>

      {/* Mark all read + Refresh + Push */}
      <div className="flex items-center justify-between gap-2">
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent2/10 text-accent2 text-[11px] font-bold hover:bg-accent2/20 transition-all disabled:opacity-50"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MaterialIcon icon="done_all" size={16} />
            )}
            {isRtl ? "تحديد الكل كمقروء" : "Mark all as read"}
          </button>
        )}
        <div className="flex gap-1 ms-auto">
          <button
            onClick={fetchNotifications}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <MaterialIcon icon="refresh" size={18} className="text-muted2" />
          </button>
          {push.isSupported && (
            <button
              onClick={() =>
                push.isSubscribed ? push.unsubscribe() : push.subscribe()
              }
              className={`p-1.5 rounded-lg transition-colors ${push.isSubscribed ? "text-green-400" : "text-muted2 hover:text-foreground"}`}
            >
              <MaterialIcon
                icon={
                  push.isSubscribed
                    ? "notifications_active"
                    : "notifications_off"
                }
                size={18}
                fill={push.isSubscribed}
              />
            </button>
          )}
        </div>
      </div>

      {/* Notifications grouped by date */}
      {groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-[13px] font-bold text-foreground mb-2.5">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((n) => {
                  const icon = ICONS[n.type] || "notifications";
                  const timeStr = (() => {
                    try {
                      const d = new Date(n.createdAt);
                      const now = new Date();
                      const diff = Math.floor(
                        (now.getTime() - d.getTime()) / 1000,
                      );
                      if (diff < 60) return isRtl ? "الآن" : "Just now";
                      if (diff < 3600)
                        return isRtl
                          ? `منذ ${Math.floor(diff / 60)} د`
                          : `${Math.floor(diff / 60)}m ago`;
                      if (diff < 86400)
                        return isRtl
                          ? `منذ ${Math.floor(diff / 3600)} س`
                          : `${Math.floor(diff / 3600)}h ago`;
                      return d.toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    } catch {
                      return "";
                    }
                  })();

                  return (
                    <div
                      key={n.id}
                      className={`relative rounded-xl p-3.5 transition-all cursor-pointer hover:shadow-sm ${
                        !n.isRead
                          ? "bg-card border border-accent2/20 shadow-sm"
                          : "bg-card border border-border2"
                      }`}
                      onClick={() => {
                        if (!n.isRead) markAsRead(n.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            n.isRead ? "bg-surface" : "bg-accent2/10"
                          }`}
                        >
                          <MaterialIcon
                            icon={icon}
                            size={18}
                            className={
                              n.isRead ? "text-muted2" : "text-accent2"
                            }
                            fill={!n.isRead}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className={`text-[13px] font-semibold leading-snug ${n.isRead ? "text-muted2" : "text-foreground"}`}
                            >
                              {isRtl ? n.titleAr || n.title : n.title}
                            </h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!n.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-accent2" />
                              )}
                              <span className="text-[9px] text-muted2 whitespace-nowrap">
                                {timeStr}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted2 mt-1 leading-relaxed">
                            {isRtl ? n.messageAr || n.message : n.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent2/10 flex items-center justify-center mb-3">
            <MaterialIcon
              icon="notifications_off"
              size={28}
              className="text-accent2/50"
            />
          </div>
          <p className="text-foreground font-semibold text-sm mb-1">
            {isRtl ? "لا توجد إشعارات" : "No notifications"}
          </p>
          <p className="text-muted2 text-[12px]">
            {isRtl
              ? "ستظهر الإشعارات هنا عند وصولها"
              : "Notifications will appear here"}
          </p>
        </div>
      )}

      {/* Need Assistance */}
      <div className="bg-gradient-to-br from-[#1A2B4C] to-[#2A3B5C] rounded-2xl p-5 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <MaterialIcon
              icon="support_agent"
              size={24}
              className="text-[#E0C070]"
            />
          </div>
        </div>
        <h3
          className="text-white text-sm font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {isRtl ? "تحتاج مساعدة؟" : "Need Assistance?"}
        </h3>
        <p className="text-white/60 text-[11px] mb-3 leading-relaxed">
          {isRtl
            ? "إذا كان لديك استفسار، فريق الموارد البشرية جاهز للمساعدة."
            : "If you have any questions, our Concierge HR team is here to help."}
        </p>
        <button className="px-4 py-2 rounded-lg bg-[#C9A24D] text-white text-[11px] font-bold hover:bg-[#B8922E] transition-all">
          {isRtl ? "تواصل مع الموارد البشرية" : "Contact HR Concierge"}
        </button>
      </div>

      {/* Quote */}
      <p
        className="text-center text-[13px] text-accent2/40 italic leading-relaxed px-4"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        &ldquo;
        {isRtl
          ? "أفضل طريقة لتجد نفسك هي أن تفقد نفسك في خدمة الآخرين."
          : "The best way to find yourself is to lose yourself in the service of others."}
        &rdquo;
      </p>
    </div>
  );
}
