import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "../lib/theme";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { apiFetch } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  useNotifications,
  portalKeys,
  type NotificationsPayload,
} from "../lib/portal-queries";
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

const PREFS_KEY = "portal_notif_muted_v1";
const ARCHIVED_KEY = "portal_notif_archived_v1";

// Known categories (type -> icon + bilingual label). Unknown types fall back to "other".
const CATEGORIES: Record<
  string,
  { icon: string; en: string; ar: string }
> = {
  payroll: { icon: "payments", en: "Payroll", ar: "الرواتب" },
  schedule: { icon: "schedule", en: "Schedule", ar: "الجدول" },
  document: { icon: "verified_user", en: "Documents", ar: "المستندات" },
  announcement: { icon: "campaign", en: "Announcements", ar: "الإعلانات" },
  security: { icon: "security", en: "Security", ar: "الأمان" },
  activity: { icon: "event", en: "Activities", ar: "الفعاليات" },
  evaluation: { icon: "star", en: "Evaluations", ar: "التقييمات" },
  maintenance: { icon: "build", en: "Maintenance", ar: "الصيانة" },
};

function catInfo(type: string) {
  return (
    CATEGORIES[type] || {
      icon: "notifications",
      en: "Other",
      ar: "أخرى",
    }
  );
}

function readJsonArray(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function readMuted(): string[] {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
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

export default function TabNotifications({ onChangeTab }: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const push = usePushNotifications();

  const queryClient = useQueryClient();
  const notificationsQuery = useNotifications();
  const notifications = (notificationsQuery.data?.notifications ??
    []) as unknown as Notification[];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const isLoading = notificationsQuery.isLoading && !notificationsQuery.data;
  const patchCache = (
    fn: (prev: NotificationsPayload) => NotificationsPayload,
  ) =>
    queryClient.setQueryData<NotificationsPayload>(
      portalKeys.notifications,
      (prev) => fn(prev ?? { notifications: [], unreadCount: 0 }),
    );
  const [markingAll, setMarkingAll] = useState(false);

  // View + filter + preferences state
  const [view, setView] = useState<"inbox" | "archived">("inbox");
  const [filter, setFilter] = useState<string>("all"); // all | unread | <type>
  const [showPrefs, setShowPrefs] = useState(false);
  const [muted, setMuted] = useState<string[]>(() => readMuted());
  const [archived, setArchived] = useState<number[]>(() =>
    readJsonArray(ARCHIVED_KEY),
  );

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(muted));
    } catch {
      /* ignore */
    }
  }, [muted]);
  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVED_KEY, JSON.stringify(archived));
    } catch {
      /* ignore */
    }
  }, [archived]);

  const archivedSet = useMemo(() => new Set(archived), [archived]);

  // Categories actually present (for the filter chip row and the prefs sheet)
  const presentTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const n of notifications) seen.add(n.type || "other");
    return Array.from(seen);
  }, [notifications]);

  const fetchNotifications = () => {
    queryClient.invalidateQueries({ queryKey: portalKeys.notifications });
  };

  const markAsRead = async (id: number) => {
    patchCache((prev) => ({
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));
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
      patchCache((prev) => ({
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
      window.dispatchEvent(new Event("refresh_notifications"));
    } catch {
      /* silent */
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleMuted = (type: string) =>
    setMuted((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );

  const archiveOne = (id: number, isRead: boolean) => {
    if (!isRead) markAsRead(id);
    setArchived((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const restoreOne = (id: number) =>
    setArchived((prev) => prev.filter((x) => x !== id));

  const archiveAllRead = () => {
    const ids = notifications
      .filter((n) => n.isRead && !archivedSet.has(n.id))
      .map((n) => n.id);
    if (ids.length) setArchived((prev) => [...prev, ...ids]);
  };
  const clearArchive = () => setArchived([]);

  // Build the list for the current view + filter + mute preferences
  const visible = useMemo(() => {
    let list = notifications;
    if (view === "archived") {
      list = list.filter((n) => archivedSet.has(n.id));
    } else {
      list = list.filter((n) => !archivedSet.has(n.id));
      // In the inbox "All" view, hide muted categories (an explicit filter still shows them).
      if (filter === "all") {
        list = list.filter((n) => !muted.includes(n.type || "other"));
      }
    }
    if (filter === "unread") list = list.filter((n) => !n.isRead);
    else if (filter !== "all") list = list.filter((n) => (n.type || "other") === filter);
    return list;
  }, [notifications, view, filter, muted, archivedSet]);

  const groups = groupByDate(visible, isRtl);
  const archivedCount = useMemo(
    () => notifications.filter((n) => archivedSet.has(n.id)).length,
    [notifications, archivedSet],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
      </div>
    );
  }

  const chip = (id: string, label: string, count?: number) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
        filter === id
          ? "bg-accent2 text-accent2-foreground"
          : "bg-surface border border-border2 text-muted2 hover:text-foreground"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 ? ` · ${count}` : ""}
    </button>
  );

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
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
        <button
          onClick={() => setShowPrefs((v) => !v)}
          aria-label={isRtl ? "تفضيلات الإشعارات" : "Notification preferences"}
          aria-expanded={showPrefs}
          className={`p-2 rounded-lg transition-colors ${
            showPrefs
              ? "bg-accent2/10 text-accent2"
              : "hover:bg-surface text-muted2"
          }`}
        >
          <MaterialIcon icon="tune" size={18} />
        </button>
      </div>

      {/* Preferences sheet */}
      {showPrefs && (
        <div className="bg-card border border-border2 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-foreground">
              {isRtl ? "تفضيلات الفئات" : "Category Preferences"}
            </h3>
            <span className="text-[10px] text-muted2">
              {isRtl ? "أطفئ الفئات غير المرغوبة" : "Mute what you don't need"}
            </span>
          </div>
          <div className="space-y-1.5">
            {(presentTypes.length ? presentTypes : Object.keys(CATEGORIES)).map(
              (type) => {
                const info = catInfo(type);
                const isMuted = muted.includes(type);
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                        <MaterialIcon
                          icon={info.icon}
                          size={16}
                          className="text-muted2"
                        />
                      </div>
                      <span className="text-[13px] text-foreground truncate">
                        {isRtl ? info.ar : info.en}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleMuted(type)}
                      role="switch"
                      aria-checked={!isMuted}
                      aria-label={isRtl ? info.ar : info.en}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        isMuted ? "bg-muted" : "bg-accent2"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                          isMuted
                            ? isRtl
                              ? "end-0.5"
                              : "start-0.5"
                            : isRtl
                              ? "start-0.5"
                              : "end-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              },
            )}
          </div>
          {push.isSupported && (
            <div className="pt-2 border-t border-border2 flex items-center justify-between">
              <span className="text-[12px] text-muted2">
                {isRtl ? "إشعارات الجهاز (Push)" : "Device push notifications"}
              </span>
              <button
                onClick={() =>
                  push.isSubscribed ? push.unsubscribe() : push.subscribe()
                }
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  push.isSubscribed
                    ? "bg-green-400/10 text-green-400"
                    : "bg-surface border border-border2 text-muted2 hover:text-foreground"
                }`}
              >
                {push.isSubscribed
                  ? isRtl
                    ? "مفعّلة"
                    : "Enabled"
                  : isRtl
                    ? "تفعيل"
                    : "Enable"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* View switch: Inbox / Archived */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setView("inbox")}
          aria-pressed={view === "inbox"}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
            view === "inbox"
              ? "bg-card border border-accent2/30 text-foreground"
              : "text-muted2 hover:text-foreground"
          }`}
        >
          {isRtl ? "الوارد" : "Inbox"}
        </button>
        <button
          onClick={() => setView("archived")}
          aria-pressed={view === "archived"}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
            view === "archived"
              ? "bg-card border border-accent2/30 text-foreground"
              : "text-muted2 hover:text-foreground"
          }`}
        >
          {isRtl ? "المؤرشفة" : "Archived"}
          {archivedCount > 0 ? ` · ${archivedCount}` : ""}
        </button>
      </div>

      {/* Filter chips (inbox only) */}
      {view === "inbox" && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {chip("all", isRtl ? "الكل" : "All")}
          {chip("unread", isRtl ? "غير المقروء" : "Unread", unreadCount)}
          {presentTypes
            .filter((t) => !muted.includes(t))
            .map((t) => chip(t, isRtl ? catInfo(t).ar : catInfo(t).en))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        {view === "inbox" ? (
          <>
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
                onClick={archiveAllRead}
                aria-label={isRtl ? "أرشفة المقروء" : "Archive read"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface text-muted2 hover:text-foreground transition-colors text-[11px] font-bold"
              >
                <MaterialIcon icon="archive" size={16} />
                <span className="hidden sm:inline">
                  {isRtl ? "أرشفة المقروء" : "Archive read"}
                </span>
              </button>
              <button
                onClick={fetchNotifications}
                aria-label={isRtl ? "تحديث الإشعارات" : "Refresh notifications"}
                className="p-1.5 rounded-lg hover:bg-surface transition-colors"
              >
                <MaterialIcon icon="refresh" size={18} className="text-muted2" />
              </button>
            </div>
          </>
        ) : (
          archivedCount > 0 && (
            <button
              onClick={clearArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-surface text-muted2 hover:text-foreground transition-colors text-[11px] font-bold ms-auto"
            >
              <MaterialIcon icon="delete_sweep" size={16} />
              {isRtl ? "إفراغ الأرشيف" : "Clear archive"}
            </button>
          )
        )}
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
                  const info = catInfo(n.type || "other");
                  const icon = info.icon;
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
                      return d.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
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
                      className={`group relative rounded-xl p-3.5 transition-all cursor-pointer hover:shadow-sm ${
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
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!n.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-accent2" />
                              )}
                              <span className="text-[9px] text-muted2 whitespace-nowrap">
                                {timeStr}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (view === "archived") restoreOne(n.id);
                                  else archiveOne(n.id, n.isRead);
                                }}
                                aria-label={
                                  view === "archived"
                                    ? isRtl
                                      ? "استعادة"
                                      : "Restore"
                                    : isRtl
                                      ? "أرشفة"
                                      : "Archive"
                                }
                                className="p-1 rounded-md text-muted2/60 hover:text-foreground hover:bg-surface transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                <MaterialIcon
                                  icon={
                                    view === "archived" ? "unarchive" : "archive"
                                  }
                                  size={15}
                                />
                              </button>
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
              icon={view === "archived" ? "archive" : "notifications_off"}
              size={28}
              className="text-accent2/50"
            />
          </div>
          <p className="text-foreground font-semibold text-sm mb-1">
            {view === "archived"
              ? isRtl
                ? "لا توجد إشعارات مؤرشفة"
                : "No archived notifications"
              : filter !== "all"
                ? isRtl
                  ? "لا توجد نتائج مطابقة"
                  : "No matching notifications"
                : isRtl
                  ? "لا توجد إشعارات"
                  : "No notifications"}
          </p>
          <p className="text-muted2 text-[12px]">
            {view === "archived"
              ? isRtl
                ? "الإشعارات التي تؤرشفها تظهر هنا"
                : "Notifications you archive appear here"
              : filter !== "all"
                ? isRtl
                  ? "جرّب فلتراً آخر"
                  : "Try a different filter"
                : isRtl
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
        <button
          onClick={() => onChangeTab?.("chat")}
          className="px-4 py-2 rounded-lg bg-[#C9A24D] text-white text-[11px] font-bold hover:bg-[#B8922E] transition-all"
        >
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
